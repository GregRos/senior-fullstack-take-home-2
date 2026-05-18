"""Inference-side utilities around the grammar-checking agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from http import HTTPStatus
import json
from pathlib import Path
import time
from typing import Literal, TypedDict, cast

from pydantic_ai import Agent
from pydantic_ai.messages import ModelRequest, ModelResponse
from pydantic_ai.models.openai import (
    OpenAIModelName,
    OpenAIResponsesModel,
)
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings
from sqlmodel import select
import tiktoken
import yaml

from config import config
from db import get_session_factory, get_user
from db.models import InferenceUsageEvent as DbInferenceUsageEvent
from db.models import User
from .models import (
    CheckRequest,
    ParagraphCorrectionResponse,
    Span,
    check_response_adapter,
)
from .prompt.examples import get_example_history
from .prompt import SYSTEM_PROMPT

type ProviderName = Literal["openai"]
type ResponseItems = list[Span]
type AgentMessageHistory = list[ModelRequest | ModelResponse]

_CORRECTION_OPERATION = "correction"


class _ApiKeyRecord(TypedDict):
    api_key: str


type _ApiKeyFile = dict[ProviderName, str | _ApiKeyRecord]


class InferenceError(Exception):
    status_code: int = int(HTTPStatus.INTERNAL_SERVER_ERROR)


class InferenceConfigError(InferenceError):
    status_code = int(HTTPStatus.INTERNAL_SERVER_ERROR)


class InferenceUserError(InferenceError):
    status_code = int(HTTPStatus.NOT_FOUND)


class InferenceCreditsError(InferenceError):
    status_code = int(HTTPStatus.PAYMENT_REQUIRED)


class InferenceUpstreamError(InferenceError):
    status_code = int(HTTPStatus.BAD_GATEWAY)


def status_code_for_error(error: Exception) -> int:
    if isinstance(error, InferenceError):
        return error.status_code

    return int(HTTPStatus.INTERNAL_SERVER_ERROR)


@dataclass(frozen=True, slots=True)
class ApiKeyManager:
    """Read provider API keys from the YAML file configured in the environment."""

    file_path: Path = field(default_factory=lambda: config.api_keys_file)

    def get(self, provider_name: ProviderName) -> str:
        data = cast(
            _ApiKeyFile,
            yaml.safe_load(self.file_path.read_text(encoding="utf-8")) or {},
        )

        if provider_name not in data:
            raise InferenceConfigError(
                f"Missing API key config for provider {provider_name}."
            )

        provider_config = data[provider_name]

        if isinstance(provider_config, str):
            return provider_config

        return provider_config["api_key"]


@dataclass(frozen=True, slots=True)
class _ResponseMetrics:
    corrections: int
    paragraphs_touched: int


@dataclass(frozen=True, slots=True)
class _RunContext:
    user_id: int
    api_key: str
    model: str
    provider_name: ProviderName = field(default="openai")
    estimated_input_tokens: int = field(default=0)
    estimated_output_tokens: int = field(default=0)


@dataclass(frozen=True, slots=True)
class _UsageSummary:
    actual_output_tokens: int
    actual_cost: int
    response_metrics: _ResponseMetrics


@dataclass(slots=True)
class InferenceService:
    """Select models, reserve credits, and persist usage for agent calls."""

    api_key_manager: ApiKeyManager = field(default_factory=ApiKeyManager)

    async def run(
        self,
        *,
        user_id: int,
        request: CheckRequest,
        provider_name: ProviderName = "openai",
        message_history: AgentMessageHistory | None = None,
    ) -> ResponseItems:
        resolved_message_history = self._message_history(message_history)
        serialized_request = self._serialize_request(request)
        run_context = await self._create_run_context(
            user_id=user_id,
            serialized_request=serialized_request,
            provider_name=provider_name,
            message_history=resolved_message_history,
        )
        agent = self._build_agent(run_context)
        started_at = time.monotonic()
        self._trace(
            "sending_message",
            **self._request_trace_details(
                run_context=run_context,
                request=request,
                serialized_request=serialized_request,
                message_history=resolved_message_history,
            ),
        )

        try:
            result = await agent.run(
                serialized_request,
                message_history=resolved_message_history,
            )
        except Exception as error:
            duration = time.monotonic() - started_at
            self._trace(
                "request_failed",
                user_id=run_context.user_id,
                model=run_context.model,
                provider_name=run_context.provider_name,
                duration_ms=self._duration_ms(duration),
                error_type=type(error).__name__,
                error_message=str(error),
            )
            raise InferenceUpstreamError("Inference request failed.") from error

        duration = time.monotonic() - started_at
        response = result.output
        usage_summary = self._summarize_usage(
            run_context=run_context,
            response=response,
            duration=duration,
        )
        self._trace(
            "received_response",
            **self._response_trace_details(
                run_context=run_context,
                response=response,
                duration=duration,
                usage_summary=usage_summary,
            ),
        )
        await self._record_usage(
            run_context=run_context,
            duration=duration,
            usage_summary=usage_summary,
        )
        return response

    async def _create_run_context(
        self,
        *,
        user_id: int,
        serialized_request: str,
        provider_name: ProviderName,
        message_history: AgentMessageHistory,
    ) -> _RunContext:
        user = await self._get_user(user_id)
        user_id = self._user_id(user)
        model = self._select_model(user)
        estimated_input_tokens = self._estimate_input_tokens(
            model=model,
            prompt=serialized_request,
            message_history=message_history,
        )
        estimated_output_tokens = self._estimate_output_tokens(
            model=model,
            estimated_input_tokens=estimated_input_tokens,
        )
        reserved_credits = self._estimate_request_cost(
            model=model,
            estimated_input_tokens=estimated_input_tokens,
            estimated_output_tokens=estimated_output_tokens,
        )

        if user.credits < reserved_credits:
            raise InferenceCreditsError(
                f"User {user_id} has {user.credits} credits, needs {reserved_credits}."
            )

        return _RunContext(
            user_id=user_id,
            provider_name=provider_name,
            api_key=self.api_key_manager.get(provider_name),
            model=model,
            estimated_input_tokens=estimated_input_tokens,
            estimated_output_tokens=estimated_output_tokens,
        )

    async def _record_usage(
        self,
        *,
        run_context: _RunContext,
        duration: float,
        usage_summary: _UsageSummary,
    ) -> DbInferenceUsageEvent:
        session_factory = await get_session_factory()
        async with session_factory() as session:
            user = await session.get(User, run_context.user_id)
            if user is None:
                raise InferenceUserError(f"User {run_context.user_id} was not found.")

            current_credits = user.credits
            if current_credits < usage_summary.actual_cost:
                raise InferenceCreditsError(
                    f"User {run_context.user_id} has {current_credits} credits, needs {usage_summary.actual_cost}."
                )

            event = DbInferenceUsageEvent(
                user_id=run_context.user_id,
                created_at=datetime.now(UTC),
                event_type=_CORRECTION_OPERATION,
                in_tokens=run_context.estimated_input_tokens,
                out_tokens=usage_summary.actual_output_tokens,
                duration=duration,
                cost=usage_summary.actual_cost,
            )
            user.credits = max(0, current_credits - usage_summary.actual_cost)

            session.add(event)
            session.add(user)
            await session.commit()
            await session.refresh(event)

        self._trace(
            "usage_recorded",
            user_id=run_context.user_id,
            model=run_context.model,
            provider_name=run_context.provider_name,
            duration_ms=self._duration_ms(duration),
            input_tokens=run_context.estimated_input_tokens,
            output_tokens=usage_summary.actual_output_tokens,
            actual_cost=usage_summary.actual_cost,
            remaining_credits=user.credits,
            corrections=usage_summary.response_metrics.corrections,
            paragraphs_touched=usage_summary.response_metrics.paragraphs_touched,
        )

        return event

    async def usage_events(self) -> list[DbInferenceUsageEvent]:
        session_factory = await get_session_factory()

        async with session_factory() as session:
            result = await session.execute(select(DbInferenceUsageEvent))
            return list(result.scalars().all())

    async def credits_for_user(self, user_id: int) -> int:
        user = await self._get_user(user_id)
        return user.credits

    async def _get_user(self, user_id: int) -> User:
        user = await get_user(user_id)
        if user is None:
            raise InferenceUserError(f"User {user_id} was not found.")
        return user

    def _select_model(self, user: User) -> str:
        return self._agent_model(user.model)

    def _build_agent(
        self, run_context: _RunContext
    ) -> Agent[None, ParagraphCorrectionResponse]:
        model_name = self._openai_model_name(run_context.model)
        return Agent(
            OpenAIResponsesModel(
                model_name,
                provider=OpenAIProvider(api_key=run_context.api_key),
            ),
            output_type=ParagraphCorrectionResponse,  # type: ignore[arg-type]
            system_prompt=SYSTEM_PROMPT,
            model_settings=self._model_settings(run_context),
        )

    def _model_settings(self, run_context: _RunContext) -> ModelSettings:
        model_settings = ModelSettings(
            timeout=config.mistakes_timeout,
            max_tokens=run_context.estimated_output_tokens,
        )
        if "gpt-5" in run_context.model:
            model_settings["thinking"] = "low"
        return model_settings

    def _estimate_request_cost(
        self,
        *,
        model: str,
        estimated_input_tokens: int,
        estimated_output_tokens: int,
    ) -> int:
        return self._calculate_cost(
            model=model,
            estimated_input_tokens=estimated_input_tokens,
            estimated_output_tokens=estimated_output_tokens,
            response_metrics=_ResponseMetrics(corrections=0, paragraphs_touched=0),
            duration=0.0,
        )

    def _calculate_cost(
        self,
        *,
        model: str,
        estimated_input_tokens: int,
        estimated_output_tokens: int,
        response_metrics: _ResponseMetrics,
        duration: float,
    ) -> int:
        base_cost = 1
        model_multiplier = 3 if "gpt-5" in model else 2 if "gpt-4" in model else 1
        token_cost = max(1, estimated_input_tokens // 400) + max(
            1, estimated_output_tokens // 300
        )
        response_cost = (
            response_metrics.corrections + response_metrics.paragraphs_touched
        )
        duration_cost = max(0, int(duration * 2))
        return base_cost + model_multiplier + token_cost + response_cost + duration_cost

    def _summarize_usage(
        self,
        *,
        run_context: _RunContext,
        response: ResponseItems,
        duration: float,
    ) -> _UsageSummary:
        response_metrics = self._response_metrics(response)
        actual_output_tokens = max(
            run_context.estimated_output_tokens,
            self._estimate_response_tokens(run_context.model, response),
        )
        actual_cost = self._calculate_cost(
            model=run_context.model,
            estimated_input_tokens=run_context.estimated_input_tokens,
            estimated_output_tokens=actual_output_tokens,
            response_metrics=response_metrics,
            duration=duration,
        )
        return _UsageSummary(
            actual_output_tokens=actual_output_tokens,
            actual_cost=actual_cost,
            response_metrics=response_metrics,
        )

    def _response_metrics(self, response: ResponseItems) -> _ResponseMetrics:
        corrections = sum(1 for item in response if item.type == "mistake")
        paragraphs_touched = 1 if any(item.type != "valid" for item in response) else 0
        return _ResponseMetrics(
            corrections=corrections,
            paragraphs_touched=paragraphs_touched,
        )

    def _request_trace_details(
        self,
        *,
        run_context: _RunContext,
        request: CheckRequest,
        serialized_request: str,
        message_history: AgentMessageHistory,
    ) -> dict[str, str | int]:
        return {
            "user_id": run_context.user_id,
            "model": run_context.model,
            "provider_name": run_context.provider_name,
            "message_history_count": len(message_history),
            "estimated_input_tokens": run_context.estimated_input_tokens,
            "estimated_output_tokens": run_context.estimated_output_tokens,
            "request_bytes": len(serialized_request.encode("utf-8")),
            "current_text_chars": len(request.input.current),
            "previous_paragraphs": len(request.input.previous),
            "next_paragraphs": len(request.input.next),
        }

    def _response_trace_details(
        self,
        *,
        run_context: _RunContext,
        response: ResponseItems,
        duration: float,
        usage_summary: _UsageSummary,
    ) -> dict[str, str | int]:
        return {
            "user_id": run_context.user_id,
            "model": run_context.model,
            "provider_name": run_context.provider_name,
            "duration_ms": self._duration_ms(duration),
            "response_items": len(response),
            "estimated_input_tokens": run_context.estimated_input_tokens,
            "estimated_output_tokens": run_context.estimated_output_tokens,
            "actual_output_tokens": usage_summary.actual_output_tokens,
            "actual_cost": usage_summary.actual_cost,
            "corrections": usage_summary.response_metrics.corrections,
            "paragraphs_touched": usage_summary.response_metrics.paragraphs_touched,
        }

    def _duration_ms(self, duration: float) -> int:
        return int(duration * 1000)

    def _trace(self, event: str, /, **details: str | int) -> None:
        detail_lines = [
            f"  {key.replace('_', ' ')}: {value}"
            for key, value in sorted(details.items())
        ]
        print(
            "\n".join([f"[InferenceService] {event.replace('_', ' ')}", *detail_lines]),
            flush=True,
        )

    def _estimate_response_tokens(self, model: str, response: ResponseItems) -> int:
        return self._count_tokens(
            model=model,
            text=check_response_adapter.dump_json(response).decode("utf-8"),
        )

    def _estimate_input_tokens(
        self,
        *,
        model: str,
        prompt: str,
        message_history: AgentMessageHistory,
    ) -> int:
        payload = self._prompt_payload(prompt, message_history)
        return self._count_tokens(model=model, text=payload)

    def _estimate_output_tokens(
        self,
        *,
        model: str,
        estimated_input_tokens: int,
    ) -> int:
        model_multiplier = 2 if "gpt-5" in model else 1
        baseline = max(192, estimated_input_tokens // 2)
        return min(2048, baseline * model_multiplier)

    def _message_history(
        self,
        message_history: AgentMessageHistory | None,
    ) -> AgentMessageHistory:
        if message_history is None:
            return [*get_example_history().example_messages]
        return [*message_history]

    def _serialize_request(self, request: CheckRequest) -> str:
        return request.model_dump_json()

    def _agent_model(self, model: str) -> str:
        provider, separator, model_name = model.partition("/")
        if separator:
            return f"{provider}:{model_name}"
        return model

    def _prompt_payload(self, prompt: str, message_history: AgentMessageHistory) -> str:
        history_payload = [
            self._serialize_message(message) for message in message_history
        ]
        return "\n".join([*history_payload, prompt])

    def _serialize_message(self, message: ModelRequest | ModelResponse) -> str:
        model_dump = getattr(message, "model_dump", None)
        if callable(model_dump):
            return json.dumps(model_dump(mode="json"), sort_keys=True)
        return str(message)

    def _count_tokens(self, *, model: str, text: str) -> int:
        encoding = self._encoding(model)
        return len(encoding.encode(text))

    def _encoding(self, model: str) -> tiktoken.Encoding:
        model_name = self._openai_model_name(model)
        if model_name.startswith(("gpt-5", "gpt-4.1", "gpt-4o", "o1", "o3", "o4")):
            return tiktoken.get_encoding("o200k_base")
        return tiktoken.get_encoding("cl100k_base")

    def _openai_model_name(self, model: str) -> OpenAIModelName:
        provider, separator, model_name = model.partition(":")
        if not separator or provider != "openai":
            raise InferenceConfigError(f"Unsupported agent model {model}.")
        return cast(OpenAIModelName, model_name)

    def _user_id(self, user: User) -> int:
        if user.id is None:
            raise InferenceUserError("Resolved user is missing an id.")
        return user.id

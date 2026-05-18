from typing import Iterable

from agent.models import (
    CheckRequest,
    ParagraphCorrectionResponse,
    Span,
    check_response_adapter,
)

_FINAL_RESULT_TOOL = "final_result"
_RETURN_VALUE_KEY = "return_value"

from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)


import json
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ExampleRequestResponsePair:
    request: CheckRequest
    response: Iterable[Span]

    def make_example_messages(self) -> list[ModelRequest | ModelResponse]:
        """Return the three messages that represent one complete few-shot exchange."""
        call_id = f"ex-{id(self.request)}"

        user_msg = ModelRequest(
            parts=[UserPromptPart(content=self.request.model_dump_json())]
        )

        response_json = json.loads(check_response_adapter.dump_json([*self.response]))
        assistant_msg = ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name=_FINAL_RESULT_TOOL,
                    args={_RETURN_VALUE_KEY: response_json},
                    tool_call_id=call_id,
                )
            ]
        )

        tool_return_msg = ModelRequest(
            parts=[
                ToolReturnPart(
                    tool_name=_FINAL_RESULT_TOOL,
                    content="Final result",
                    tool_call_id=call_id,
                )
            ]
        )

        return [user_msg, assistant_msg, tool_return_msg]


@dataclass(frozen=True, slots=True)
class MessageHistory:
    example_messages: list[ModelRequest | ModelResponse]

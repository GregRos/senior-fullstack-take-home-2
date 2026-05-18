"""HTTP endpoint definitions for the journal API."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from agent import CheckRequest, ParagraphCorrectionResponse, InferenceService
from agent.models import (
    AUTO_DETECT_LANGUAGE,
    ParagraphCorrectionRequest,
    LanguageSpec,
)
from agent.models import check_response_adapter
from db import (
    create_empty_journal_entry,
    create_mistake_history_entries,
    delete_journal_entry,
    get_journal_entry,
    get_user,
    list_journal_entries,
    list_languages,
    list_mistake_history_entries,
    update_journal_entry,
)
from db.models import (
    DEFAULT_JOURNAL_LANGUAGE,
    DEFAULT_USER_ID,
    JournalEntry,
    JournalEntrySummary,
    Language,
)

router = APIRouter()


_CAMEL = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Request / response models ─────────────────────────────────────────────────


class _EntryPatch(BaseModel):
    model_config = _CAMEL
    language: str | None = None
    content: dict[str, Any] | None = None


class _EntryCreate(BaseModel):
    model_config = _CAMEL
    language: str = DEFAULT_JOURNAL_LANGUAGE


class _MistakesRequest(BaseModel):
    model_config = _CAMEL
    paragraph: str
    language: str | None = None
    context_before: list[str] = []
    context_after: list[str] = []


class _MistakesAck(BaseModel):
    model_config = _CAMEL
    status: str
    entry_id: int
    corrections: list[Any]


class _DailyStats(BaseModel):
    model_config = _CAMEL
    date: str
    total: int
    by_type: dict[str, int]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/api/login")
async def login():
    return await get_user(DEFAULT_USER_ID)


@router.get("/api/me")
async def get_me(request: Request):
    return request.state.user


@router.get("/api/entries")
async def get_entries(request: Request) -> list[JournalEntrySummary]:
    user = request.state.user
    return await list_journal_entries(user)


@router.get("/api/languages")
async def get_languages() -> list[Language]:
    return await list_languages()


@router.get("/api/entry/{entry_id}")
async def get_entry(entry_id: int, request: Request) -> JournalEntry:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0
    entry = await get_journal_entry(user_id, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Entry {entry_id} not found"
        )
    return entry


@router.post("/api/entry", status_code=status.HTTP_201_CREATED)
async def create_entry(
    request: Request, body: _EntryCreate | None = None
) -> JournalEntry:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0
    return await create_empty_journal_entry(
        user_id,
        language=body.language if body is not None else DEFAULT_JOURNAL_LANGUAGE,
    )


@router.patch("/api/entry/{entry_id}")
async def update_entry(
    entry_id: int, patch: _EntryPatch, request: Request
) -> JournalEntry:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0
    entry = await update_journal_entry(
        user_id,
        entry_id,
        language=patch.language,
        content=patch.content,
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entry {entry_id} not found",
        )

    return entry


@router.delete("/api/entry/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(entry_id: int, request: Request) -> Response:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0
    was_deleted = await delete_journal_entry(user_id, entry_id)
    if not was_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entry {entry_id} not found",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/stats")
async def get_stats(request: Request) -> list[_DailyStats]:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0
    rows = await list_mistake_history_entries(user_id)

    by_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        date_str = row.created_at.date().isoformat()
        by_date[date_str][row.category] += 1

    return [
        _DailyStats(
            date=date_str,
            total=sum(counts.values()),
            by_type=dict(counts),
        )
        for date_str, counts in sorted(by_date.items(), reverse=True)
    ]


@router.post("/api/entry/{entry_id}/mistakes", status_code=status.HTTP_202_ACCEPTED)
async def check_mistakes(
    entry_id: int, body: _MistakesRequest, request: Request
) -> _MistakesAck:
    user = request.state.user
    user_id: int = user.id if user.id is not None else 0

    entry = await get_journal_entry(user_id, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Entry {entry_id} not found"
        )

    selected_language = body.language or entry.language or DEFAULT_JOURNAL_LANGUAGE
    interface_language = (
        DEFAULT_JOURNAL_LANGUAGE
        if selected_language == AUTO_DETECT_LANGUAGE
        else selected_language
    )

    check_request = CheckRequest(
        language=LanguageSpec(
            input=selected_language,
            interface=interface_language,
        ),
        input=ParagraphCorrectionRequest(
            previous=body.context_before,
            current=body.paragraph,
            next=body.context_after,
        ),
    )

    inference_service = InferenceService()
    response_items: ParagraphCorrectionResponse = await inference_service.run(
        user_id=user_id,
        request=check_request,
    )

    mistake_categories: list[str] = []
    for item in response_items:
        if item.type == "mistake":
            mistake_categories.append(item.category)

    await create_mistake_history_entries(
        user_id,
        entry_id,
        mistake_categories,
    )

    return _MistakesAck(
        status="ok",
        entry_id=entry_id,
        corrections=check_response_adapter.dump_python(response_items, mode="json"),
    )

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from sqlmodel import col
from sqlmodel import select

import api as api_module
from agent.models import AUTO_DETECT_LANGUAGE, ErrorSpan, MistakeSpan, ValidSpan
from db.models import DEFAULT_JOURNAL_LANGUAGE, DEFAULT_USER_ID, MistakeHistoryEntry


def _install_fake_inference(
    monkeypatch: pytest.MonkeyPatch,
    *,
    response_items: list[Any],
    captured_requests: list[dict[str, Any]],
) -> None:
    class FakeInferenceService:
        async def run(self, *, user_id: int, request, **_: Any):
            captured_requests.append(
                {
                    "user_id": user_id,
                    "request": request,
                }
            )
            return response_items

    monkeypatch.setattr(api_module, "InferenceService", FakeInferenceService)


async def _history_categories(session_factory, *, entry_id: int) -> list[str]:
    async with session_factory() as session:
        result = await session.execute(
            select(MistakeHistoryEntry.category)
            .where(
                MistakeHistoryEntry.user_id == DEFAULT_USER_ID,
                MistakeHistoryEntry.journal_entry_id == entry_id,
            )
            .order_by(col(MistakeHistoryEntry.id).asc())
        )
        return list(result.scalars().all())


def test_check_mistakes_returns_404_for_missing_entry(client) -> None:
    response = client.post(
        "/api/entry/999999/mistakes",
        headers={"Authorization": str(DEFAULT_USER_ID)},
        json={"paragraph": "A paragraph to inspect."},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Entry 999999 not found"}


def test_check_mistakes_prefers_request_language_and_records_only_mistakes(
    client,
    make_entry,
    monkeypatch: pytest.MonkeyPatch,
    session_factory,
) -> None:
    entry = make_entry(language="es-ES")
    assert entry.id is not None

    captured_requests: list[dict[str, Any]] = []
    response_items = [
        ValidSpan(source="I "),
        MistakeSpan(
            category="article",
            reason="This noun needs an article.",
            source="cat",
            target=[ValidSpan(source="the cat")],
        ),
        ErrorSpan(
            category="unclear",
            reason="The source text is too ambiguous.",
            source="???",
        ),
        MistakeSpan(
            category="tense",
            reason="Past time needs a past-tense verb.",
            source="go",
            target=[ValidSpan(source="went")],
        ),
    ]
    _install_fake_inference(
        monkeypatch,
        response_items=response_items,
        captured_requests=captured_requests,
    )

    response = client.post(
        f"/api/entry/{entry.id}/mistakes",
        headers={"Authorization": str(DEFAULT_USER_ID)},
        json={
            "paragraph": "I cat go",
            "language": "fr-FR",
            "contextBefore": ["Before context."],
            "contextAfter": ["After context."],
        },
    )

    assert response.status_code == 202
    assert len(captured_requests) == 1
    assert captured_requests[0]["user_id"] == DEFAULT_USER_ID
    assert captured_requests[0]["request"].language.input == "fr-FR"
    assert captured_requests[0]["request"].language.interface == "fr-FR"
    assert captured_requests[0]["request"].input.previous == ["Before context."]
    assert captured_requests[0]["request"].input.next == ["After context."]

    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["entryId"] == entry.id
    assert [item["type"] for item in payload["corrections"]] == [
        "valid",
        "mistake",
        "error",
        "mistake",
    ]

    assert asyncio.run(_history_categories(session_factory, entry_id=entry.id)) == [
        "article",
        "tense",
    ]


def test_check_mistakes_uses_entry_language_when_request_omits_it(
    client,
    make_entry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entry = make_entry(language="de-DE")
    assert entry.id is not None

    captured_requests: list[dict[str, Any]] = []
    _install_fake_inference(
        monkeypatch,
        response_items=[ValidSpan(source="Alles gut.")],
        captured_requests=captured_requests,
    )

    response = client.post(
        f"/api/entry/{entry.id}/mistakes",
        headers={"Authorization": str(DEFAULT_USER_ID)},
        json={"paragraph": "Alles gut."},
    )

    assert response.status_code == 202
    assert captured_requests[0]["request"].language.input == "de-DE"
    assert captured_requests[0]["request"].language.interface == "de-DE"


def test_check_mistakes_maps_auto_detect_to_default_interface_language(
    client,
    make_entry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entry = make_entry(language="")
    assert entry.id is not None

    captured_requests: list[dict[str, Any]] = []
    _install_fake_inference(
        monkeypatch,
        response_items=[ValidSpan(source="Texto.")],
        captured_requests=captured_requests,
    )

    response = client.post(
        f"/api/entry/{entry.id}/mistakes",
        headers={"Authorization": str(DEFAULT_USER_ID)},
        json={
            "paragraph": "Texto.",
            "language": AUTO_DETECT_LANGUAGE,
        },
    )

    assert response.status_code == 202
    assert captured_requests[0]["request"].language.input == AUTO_DETECT_LANGUAGE
    assert (
        captured_requests[0]["request"].language.interface == DEFAULT_JOURNAL_LANGUAGE
    )

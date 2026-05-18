from __future__ import annotations

import asyncio
from collections.abc import Callable, Generator
from typing import Any, Coroutine, TypeVar

import pytest
from fastapi.testclient import TestClient

from config import config
from db import ensure_database, get_session_factory
from db.create import dispose_engine
from db.models import DEFAULT_JOURNAL_LANGUAGE, DEFAULT_USER_ID, JournalEntry
from server import app

_T = TypeVar("_T")


def _clear_config_cache() -> None:
    config.__dict__.pop("db_path", None)


def _default_content(paragraph: str = "A short valid paragraph.") -> dict[str, Any]:
    return {
        "0": [
            {
                "type": "valid",
                "source": paragraph,
            }
        ]
    }


def _run(coroutine: Coroutine[Any, Any, _T]) -> _T:
    return asyncio.run(coroutine)


@pytest.fixture
def isolated_backend_state(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> Generator[None, None, None]:
    db_path = tmp_path / "test.sqlite"
    monkeypatch.setenv("TY_DB_PATH", str(db_path))
    _clear_config_cache()
    _ = _run(dispose_engine())

    yield

    _ = _run(dispose_engine())
    _clear_config_cache()


@pytest.fixture
def session_factory(isolated_backend_state: None):
    _ = _run(ensure_database())
    return _run(get_session_factory())


@pytest.fixture
def client(isolated_backend_state: None) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def make_entry(session_factory) -> Callable[..., JournalEntry]:
    def _make_entry(
        *,
        user_id: int = DEFAULT_USER_ID,
        language: str = DEFAULT_JOURNAL_LANGUAGE,
        content: dict[str, Any] | None = None,
    ) -> JournalEntry:
        async def _create_entry() -> JournalEntry:
            entry = JournalEntry.model_validate(
                {
                    "user_id": user_id,
                    "language": language,
                    "content": content or _default_content(),
                }
            )

            async with session_factory() as session:
                session.add(entry)
                await session.commit()
                await session.refresh(entry)

            return entry

        return _run(_create_entry())

    return _make_entry

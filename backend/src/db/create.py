"""Async SQLModel engine bootstrap and schema verification."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Protocol, TypedDict

from sqlalchemy import event, inspect
from sqlalchemy.engine import Connection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel, select

from config import config

from .models import DEFAULT_MISTAKE_CATEGORIES
from .models import DEFAULT_LANGUAGES
from .models import DEFAULT_USER_ID
from .models import DEFAULT_USER_MODEL
from .models import DEFAULT_USER_NAME
from .models import JournalEntry
from .models import Language
from .models import MistakeCategory
from .models import UNLIMITED_CREDITS
from .models import User


class _SeedJournalEntry(TypedDict):
    language: str
    paragraphs: tuple[str, ...]


def _seed_content(
    paragraphs: tuple[str, ...],
) -> dict[str, Any]:
    from agent.models import ValidSpan, check_response_adapter

    return {
        str(index): check_response_adapter.dump_python(
            [ValidSpan(type="valid", source=paragraph)],
            mode="json",
        )
        for index, paragraph in enumerate(paragraphs)
    }


_DEFAULT_JOURNAL_ENTRIES: tuple[_SeedJournalEntry, ...] = (
    {
        "language": "en-GB",
        "paragraphs": (
            "I started this journal so I can practice writing a little every day.",
            "My goal is to notice patterns in my mistakes and improve over time.",
        ),
    },
    {
        "language": "es-ES",
        "paragraphs": (
            "Hoy escribi una entrada corta sobre mi semana para practicar espanol.",
            "Quiero volver manana y corregirla con mas cuidado.",
        ),
    },
)


class _DbapiCursor(Protocol):
    def execute(self, statement: str, parameters: object = None, /) -> object: ...

    def close(self) -> None: ...


class _DbapiConnection(Protocol):
    def cursor(self) -> _DbapiCursor: ...


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_bootstrapped = False
_bootstrap_lock = asyncio.Lock()


def _default_db_path() -> Path:
    return Path(config.db_path)


def _default_db_url() -> str:
    return f"sqlite+aiosqlite:///{_default_db_path()}"


def _database_sidecar_paths(path: Path) -> tuple[Path, ...]:
    return (
        path,
        path.with_name(f"{path.name}-shm"),
        path.with_name(f"{path.name}-wal"),
    )


def _expected_schema() -> dict[str, frozenset[str]]:
    return {
        table.name: frozenset(column.name for column in table.columns)
        for table in SQLModel.metadata.sorted_tables
    }


def _on_connect(dbapi_connection: _DbapiConnection, _connection_record: object) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.close()


def _configure_engine(engine: AsyncEngine) -> None:
    event.listen(engine.sync_engine, "connect", _on_connect)


def get_engine() -> AsyncEngine:
    global _engine

    if _engine is None:
        engine = create_async_engine(_default_db_url(), future=True)
        _configure_engine(engine)
        _engine = engine

    return _engine


def _session_factory_instance() -> async_sessionmaker[AsyncSession]:
    global _session_factory

    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )

    return _session_factory


async def get_session_factory() -> async_sessionmaker[AsyncSession]:
    await ensure_database()
    return _session_factory_instance()


def _inspect_schema(sync_conn: Connection) -> dict[str, frozenset[str]]:
    inspector: Inspector = inspect(sync_conn)
    actual: dict[str, frozenset[str]] = {}

    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        actual[table_name] = frozenset(column["name"] for column in columns)

    return actual


async def _verify_schema() -> None:
    expected = _expected_schema()

    async with get_engine().connect() as conn:
        actual = await conn.run_sync(_inspect_schema)

    for table_name, expected_columns in expected.items():
        if table_name not in actual:
            raise RuntimeError(
                f"Database schema error: table '{table_name}' is missing. "
                "Delete the SQLite file and restart."
            )

        missing_columns = expected_columns - actual[table_name]
        if missing_columns:
            raise RuntimeError(
                f"Database schema error: table '{table_name}' is missing columns "
                f"{sorted(missing_columns)}. Delete the SQLite file and restart."
            )


async def _create_schema() -> None:
    async with get_engine().begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def _reset_database(path: Path) -> None:
    await dispose_engine()

    for candidate in _database_sidecar_paths(path):
        if candidate.exists():
            candidate.unlink()


async def _seed_defaults() -> None:
    async with _session_factory_instance()() as session:
        user = await session.get(User, DEFAULT_USER_ID)
        if user is None:
            session.add(
                User(
                    id=DEFAULT_USER_ID,
                    name=DEFAULT_USER_NAME,
                    credits=UNLIMITED_CREDITS,
                    model=DEFAULT_USER_MODEL,
                )
            )

        result = await session.execute(select(Language.code))
        existing_language_codes = set(result.scalars().all())
        for code, local_name, display_name in DEFAULT_LANGUAGES:
            if code not in existing_language_codes:
                session.add(
                    Language(
                        code=code,
                        local_name=local_name,
                        display_name=display_name,
                    )
                )

        result = await session.execute(select(MistakeCategory.code))
        existing_codes = set(result.scalars().all())
        for code, title in DEFAULT_MISTAKE_CATEGORIES:
            if code not in existing_codes:
                session.add(MistakeCategory(code=code, title=title))

        existing_entry_ids = await session.execute(
            select(JournalEntry.id)
            .where(JournalEntry.user_id == DEFAULT_USER_ID)
            .limit(1)
        )
        has_seed_entries = existing_entry_ids.scalar_one_or_none() is not None
        if not has_seed_entries:
            session.add_all(
                [
                    JournalEntry(
                        user_id=DEFAULT_USER_ID,
                        language=seed_entry["language"],
                        content=_seed_content(seed_entry["paragraphs"]),
                    )
                    for seed_entry in _DEFAULT_JOURNAL_ENTRIES
                ]
            )

        await session.commit()


async def ensure_database() -> None:
    global _bootstrapped

    if _bootstrapped:
        return

    async with _bootstrap_lock:
        if _bootstrapped:
            return

        path = _default_db_path()
        existed = path.exists()
        path.parent.mkdir(parents=True, exist_ok=True)

        if not existed:
            await _create_schema()
        elif config.dev_truncate_db:
            await _reset_database(path)
            await _create_schema()
        else:
            try:
                await _verify_schema()
            except RuntimeError:
                await _reset_database(path)
                await _create_schema()

        await _seed_defaults()
        _bootstrapped = True


async def dispose_engine() -> None:
    global _bootstrapped
    global _engine
    global _session_factory

    if _engine is not None:
        await _engine.dispose()

    _engine = None
    _session_factory = None
    _bootstrapped = False

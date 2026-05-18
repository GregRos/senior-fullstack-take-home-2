"""Async SQLModel data access layer."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from .create import get_session_factory
from .models import InferenceUsageEvent
from .models import DEFAULT_JOURNAL_LANGUAGE
from .models import count_mistakes_in_content
from .models import JournalEntry
from .models import JournalEntrySummary
from .models import Language
from .models import MistakeCategory
from .models import MistakeEntry
from .models import MistakeHistoryEntry
from .models import User


async def _persist[T](session: AsyncSession, model: T) -> T:
    session.add(model)
    await session.commit()
    await session.refresh(model)
    return model


def _summary_from_entry(entry: JournalEntry) -> JournalEntrySummary:
    return JournalEntrySummary.model_validate(entry.model_dump(exclude={"content"}))


async def get_user(user_id: int) -> User | None:
    session_factory = await get_session_factory()

    async with session_factory() as session:
        return await session.get(User, user_id)


async def list_journal_entries(user: User) -> list[JournalEntrySummary]:
    session_factory = await get_session_factory()

    statement = (
        select(JournalEntry)
        .where(JournalEntry.user_id == user.id)
        .order_by(col(JournalEntry.created_at).desc())
    )

    async with session_factory() as session:
        result = await session.execute(statement)
        entries = result.scalars().all()

    return [_summary_from_entry(entry) for entry in entries]


async def list_languages() -> list[Language]:
    session_factory = await get_session_factory()

    statement = select(Language).order_by(col(Language.id).asc())

    async with session_factory() as session:
        result = await session.execute(statement)
        return list(result.scalars().all())


async def create_journal_entry(entry: JournalEntry) -> JournalEntry:
    session_factory = await get_session_factory()
    entry.mistake_count = count_mistakes_in_content(entry.content)

    async with session_factory() as session:
        return await _persist(session, entry)


async def create_empty_journal_entry(
    user_id: int,
    *,
    language: str = DEFAULT_JOURNAL_LANGUAGE,
) -> JournalEntry:
    return await create_journal_entry(
        JournalEntry(
            user_id=user_id,
            language=language,
            content={},
        )
    )


async def get_journal_entry(user_id: int, entry_id: int) -> JournalEntry | None:
    session_factory = await get_session_factory()

    statement = select(JournalEntry).where(
        JournalEntry.id == entry_id,
        JournalEntry.user_id == user_id,
    )

    async with session_factory() as session:
        result = await session.execute(statement)
        return result.scalar_one_or_none()


async def update_journal_entry(
    user_id: int,
    entry_id: int,
    *,
    language: str | None = None,
    content: dict[str, Any] | None = None,
) -> JournalEntry | None:
    session_factory = await get_session_factory()

    statement = select(JournalEntry).where(
        JournalEntry.id == entry_id,
        JournalEntry.user_id == user_id,
    )

    async with session_factory() as session:
        result = await session.execute(statement)
        entry = result.scalar_one_or_none()
        if entry is None:
            return None

        if language is not None:
            entry.language = language
        if content is not None:
            entry.content = content
            entry.mistake_count = count_mistakes_in_content(content)
        entry.updated_at = datetime.now(UTC)

        return await _persist(session, entry)


async def delete_journal_entry(user_id: int, entry_id: int) -> bool:
    session_factory = await get_session_factory()

    entry_statement = select(JournalEntry).where(
        JournalEntry.id == entry_id,
        JournalEntry.user_id == user_id,
    )
    mistake_statement = select(MistakeHistoryEntry).where(
        MistakeHistoryEntry.journal_entry_id == entry_id
    )

    async with session_factory() as session:
        entry_result = await session.execute(entry_statement)
        entry = entry_result.scalar_one_or_none()
        if entry is None:
            return False

        mistakes_result = await session.execute(mistake_statement)
        mistakes = mistakes_result.scalars().all()

        for mistake in mistakes:
            await session.delete(mistake)

        await session.delete(entry)
        await session.commit()
        return True


async def list_mistake_history_entries(user_id: int) -> list[MistakeHistoryEntry]:
    session_factory = await get_session_factory()

    statement = select(MistakeHistoryEntry).where(
        MistakeHistoryEntry.user_id == user_id
    )

    async with session_factory() as session:
        result = await session.execute(statement)
        return list(result.scalars().all())


async def create_mistake_history_entries(
    user_id: int,
    entry_id: int,
    categories: list[str],
) -> None:
    session_factory = await get_session_factory()

    async with session_factory() as session:
        cat_result = await session.execute(select(MistakeCategory))
        known_categories = {
            category.code: category for category in cat_result.scalars().all()
        }

        entries = [
            MistakeHistoryEntry(
                user_id=user_id,
                journal_entry_id=entry_id,
                mistake_category_id=category.id,
                category=code,
            )
            for code in categories
            if (category := known_categories.get(code)) is not None
            and category.id is not None
        ]

        if not entries:
            return

        session.add_all(entries)
        await session.commit()


async def create_mistake_entry(entry: MistakeEntry) -> MistakeEntry:
    session_factory = await get_session_factory()

    async with session_factory() as session:
        return await _persist(session, entry)


async def create_inference_usage_event(
    event: InferenceUsageEvent,
) -> InferenceUsageEvent:
    session_factory = await get_session_factory()

    async with session_factory() as session:
        return await _persist(session, event)

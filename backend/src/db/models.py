"""SQLModel table and DTO definitions for the SQLite data layer."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, cast

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import JSON, Column, Index
from sqlmodel._compat import SQLModelConfig
from sqlmodel import Field, SQLModel

_CAMEL = cast(
    SQLModelConfig,
    ConfigDict(alias_generator=to_camel, populate_by_name=True),
)

DEFAULT_USER_ID = 1
DEFAULT_USER_NAME = "you"
DEFAULT_USER_MODEL = "openai/gpt-5.4"
DEFAULT_JOURNAL_LANGUAGE = "en-GB"
UNLIMITED_CREDITS = 9_223_372_036_854_775_807

DEFAULT_LANGUAGES: tuple[tuple[str, str, str], ...] = (
    ("en-GB", "English (UK)", "English (UK)"),
    ("en-US", "English (US)", "English (US)"),
    ("zh-CN", "中文", "Chinese"),
    ("he-IL", "עברית", "Hebrew"),
    ("ja-JP", "日本語", "Japanese"),
    ("ko-KR", "한국어", "Korean"),
    ("ru-RU", "Русский", "Russian"),
    ("es-ES", "Español", "Spanish"),
    ("fr-FR", "Français", "French"),
    ("de-DE", "Deutsch", "German"),
    ("it-IT", "Italiano", "Italian"),
    ("pt-BR", "Português (Brasil)", "Portuguese (Brazil)"),
)

DEFAULT_MISTAKE_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("spelling", "Spelling"),
    ("punctuation", "Punctuation"),
    ("capitalization", "Capitalization"),
    ("conjugation", "Conjugation"),
    ("agreement", "Agreement"),
    ("tense", "Tense"),
    ("word-order", "Word Order"),
    ("article", "Article"),
    ("preposition", "Preposition"),
    ("pronoun", "Pronoun"),
    ("redundancy", "Redundancy"),
    ("clause-structure", "Clause Structure"),
    ("other", "Other Mistake Type"),
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _count_mistakes_in_value(value: Any) -> int:
    if isinstance(value, list):
        return sum(_count_mistakes_in_value(item) for item in value)

    if not isinstance(value, dict):
        return 0

    count = 1 if value.get("type") == "mistake" else 0
    return count + _count_mistakes_in_value(value.get("target"))


def count_mistakes_in_content(content: dict[str, Any]) -> int:
    return sum(_count_mistakes_in_value(value) for value in content.values())


class User(SQLModel, table=True):
    model_config = _CAMEL
    __tablename__ = cast(Any, "users")

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    credits: int = Field(default=UNLIMITED_CREDITS)
    model: str = Field(default=DEFAULT_USER_MODEL)


class Language(SQLModel, table=True):
    model_config = _CAMEL
    __tablename__ = cast(Any, "languages")

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    local_name: str
    display_name: str


class JournalEntrySummary(SQLModel):
    model_config = _CAMEL
    id: int | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime
    language: str
    mistake_count: int = 0


class JournalEntry(JournalEntrySummary, table=True):
    __tablename__ = cast(Any, "journal_entries")
    __table_args__ = (
        Index("ix_journal_entries_user_created_at", "user_id", "created_at"),
        Index("ix_journal_entries_user_updated_at", "user_id", "updated_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    mistake_count: int = Field(default=0, nullable=False)
    content: dict[str, Any] = Field(
        sa_column=Column(JSON, nullable=False),
    )


class MistakeCategory(SQLModel, table=True):
    model_config = _CAMEL
    __tablename__ = cast(Any, "mistake_categories")

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    title: str


class MistakeHistoryEntry(SQLModel, table=True):
    model_config = _CAMEL
    __tablename__ = cast(Any, "mistake_history_entries")

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    journal_entry_id: int = Field(foreign_key="journal_entries.id", index=True)
    mistake_category_id: int = Field(foreign_key="mistake_categories.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    category: str


class InferenceUsageEvent(SQLModel, table=True):
    model_config = _CAMEL
    __tablename__ = cast(Any, "inference_usage_events")

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    event_type: str
    in_tokens: int
    out_tokens: int
    duration: float
    cost: int


type MistakeEntry = MistakeHistoryEntry

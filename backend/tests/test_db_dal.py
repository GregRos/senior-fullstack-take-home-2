from __future__ import annotations

import asyncio

import pytest

from db.dal import get_journal_entry, update_journal_entry
from db.models import DEFAULT_USER_ID, count_mistakes_in_content


def test_update_journal_entry_recomputes_mistake_count_and_updated_at(make_entry):
    original_entry = make_entry(
        content={
            "0": [
                {
                    "type": "valid",
                    "source": "I go to school yesterday.",
                }
            ]
        }
    )
    assert original_entry.id is not None

    updated_content = {
        "0": [
            {
                "type": "mistake",
                "category": "tense",
                "reason": "Past time needs a past-tense verb.",
                "source": "go",
                "target": [
                    {
                        "type": "valid",
                        "source": "went",
                    }
                ],
            },
            {
                "type": "mistake",
                "category": "punctuation",
                "reason": "End the sentence with punctuation.",
                "source": "yesterday",
                "target": [
                    {
                        "type": "valid",
                        "source": "yesterday.",
                    }
                ],
            },
        ]
    }

    updated_entry = asyncio.run(
        update_journal_entry(
            DEFAULT_USER_ID,
            original_entry.id,
            language="fr-FR",
            content=updated_content,
        )
    )

    assert updated_entry is not None
    assert updated_entry.language == "fr-FR"
    assert updated_entry.content == updated_content
    assert updated_entry.mistake_count == count_mistakes_in_content(updated_content)
    assert updated_entry.updated_at > original_entry.updated_at


def test_update_journal_entry_returns_none_for_non_owner(make_entry):
    entry = make_entry(language="es-ES")
    assert entry.id is not None

    updated_entry = asyncio.run(
        update_journal_entry(
            DEFAULT_USER_ID + 99,
            entry.id,
            language="de-DE",
        )
    )

    persisted_entry = asyncio.run(get_journal_entry(DEFAULT_USER_ID, entry.id))

    assert updated_entry is None
    assert persisted_entry is not None
    assert persisted_entry.language == "es-ES"

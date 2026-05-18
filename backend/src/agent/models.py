"""Pydantic models for the grammar-checking agent's input and output."""

from __future__ import annotations

from typing import Annotated, Literal, Never, Union

from pydantic import BaseModel, Field, TypeAdapter

# ---------------------------------------------------------------------------
# Shared vocabulary
# ---------------------------------------------------------------------------

MistakeCategory = Literal[
    "spelling",
    "punctuation",
    "capitalization",
    "conjugation",
    "agreement",
    "tense",
    "word-order",
    "article",
    "preposition",
    "pronoun",
    "word-choice",
    "redundancy",
    "clause-structure",
    "other",
]

ErrorCategory = Literal[
    "unclear",
    "unexpected_language",
    "offensive",
]

_REASON_FIELD = Field(
    description=(
        "The single, individual rule that was broken by this mistake. Must be written in English."
    )
)

_ERROR_REASON_FIELD = Field(
    description=(
        "The reason this span cannot be corrected. Must be written in English."
    )
)

AUTO_DETECT_LANGUAGE = "auto"

# ---------------------------------------------------------------------------
# Input schema
# ---------------------------------------------------------------------------


class LanguageSpec(BaseModel):
    input: str = Field(
        description=(
            "The language of the student's text. Auto detect if set to 'auto'."
        )
    )
    interface: str = Field(
        description=("The language in which the reason fields should be written.")
    )


class ParagraphCorrectionRequest(BaseModel):
    previous: list[str] = Field(
        description=(
            "Paragraphs written by the student that precede the current one. "
            "Provided for context only; must not be corrected."
        )
    )
    current: str = Field(
        description="The paragraph the student just wrote. This is the only text that should be analysed and corrected. It should be analysed in isolation, without any of the context paragraphs."
    )
    next: list[str] = Field(
        description=(
            "Paragraphs written by the student that follow the current one. "
            "Provided for context only; must not be corrected."
        )
    )


class CheckRequest(BaseModel):
    language: LanguageSpec
    input: ParagraphCorrectionRequest


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------


class ValidSpan(BaseModel):
    """A verbatim run of text that is correct and requires no changes."""

    source: str = Field(
        description="The exact span of text that is correct and should be left unchanged."
    )
    type: Literal["valid"] = Field(default="valid")


class ErrorSpan(BaseModel):
    """A source span that is wrong but cannot be corrected."""

    type: Literal["error"] = Field(default="error")
    source: str = Field(
        description="The exact span of text that is wrong and cannot be corrected."
    )
    category: ErrorCategory
    reason: str = _ERROR_REASON_FIELD


class _MistakeBase(BaseModel):
    type: Literal["mistake"] = Field(default="mistake")
    category: MistakeCategory
    reason: str = _REASON_FIELD


class MistakeSpan(_MistakeBase):
    """Replace one source span with corrected output items."""

    source: str = Field(
        description=(
            "The exact source span being replaced. It must always anchor to text "
            "from the original paragraph, even for insertions."
        )
    )
    target: list[NonErrorSpan] = Field(
        description=(
            "The replacement items. Use an empty list for deletions. For insertions, "
            "include the anchored source text inside the replacement output. May "
            "include nested mistake spans if there are multiple issues within the "
            "replaced text."
        )
    )


NonErrorSpan = Annotated[
    Union[ValidSpan, MistakeSpan],
    Field(discriminator="type"),
]

Span = Annotated[
    Union[ValidSpan, MistakeSpan, ErrorSpan],
    Field(discriminator="type"),
]

# Resolve forward references now that all concrete types are defined.
MistakeSpan.model_rebuild()
ErrorSpan.model_rebuild()

ParagraphCorrectionResponse = list[Span]

# TypeAdapter for serialising / deserialising the full response list.
check_response_adapter: TypeAdapter[ParagraphCorrectionResponse] = TypeAdapter(
    ParagraphCorrectionResponse
)

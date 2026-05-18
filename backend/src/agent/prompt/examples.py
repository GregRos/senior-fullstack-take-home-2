"""Typed few-shot examples for the grammar-checking agent."""

from __future__ import annotations


from agent.prompt.example_types import ExampleRequestResponsePair, MessageHistory

from ..models import (
    CheckRequest,
    ErrorSpan,
    LanguageSpec,
    MistakeSpan,
    ParagraphCorrectionRequest,
    ValidSpan,
)

EXAMPLE_1 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="I had a birthday yesterday. First my time of making party.",
            next=[],
        ),
    ),
    response=[
        ValidSpan(source="I had a birthday yesterday. "),
        MistakeSpan(
            category="clause-structure",
            source="First my time",
            reason=("This fragment needs a subject and finite verb. "),
            target=[
                ValidSpan(source="It was "),
                MistakeSpan(
                    category="word-order",
                    source="First my",
                    reason=(
                        "In English noun phrases, the possessive comes before the ordinal."
                    ),
                    target=[ValidSpan(source="my first")],
                ),
            ],
        ),
        ValidSpan(source=" time "),
        MistakeSpan(
            category="preposition",
            source="of making",
            reason=(
                "The verb 'make' does not need the preposition 'of' here. Remove 'of'."
            ),
            target=[
                MistakeSpan(
                    category="word-choice",
                    source="making",
                    reason=(
                        "The verb 'make' is unusual in this context. Use 'having' instead."
                    ),
                    target=[ValidSpan(source="having")],
                )
            ],
        ),
        ValidSpan(source=" "),
        MistakeSpan(
            category="article",
            source="party",
            reason=("'Party' is a singular countable noun here. Add the article 'a'."),
            target=[ValidSpan(source="a party")],
        ),
        ValidSpan(source="."),
    ],
)


# ---- Example 2 input/output -----------------------------------------------
#
# "Steve" is fine.
# "store goed" needs an outer word-order replacement, with nested fixes for the
# bad conjugation and the anchored insertion inside the destination phrase.

EXAMPLE_2 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="Steve store goed.",
            next=[],
        ),
    ),
    response=[
        ValidSpan(source="Steve "),
        MistakeSpan(
            category="word-order",
            source="store goed",
            reason=("The verb should come before the destination phrase in English."),
            target=[
                MistakeSpan(
                    category="conjugation",
                    source="goed",
                    reason="'Go' is irregular in the past tense. Use 'went'.",
                    target=[ValidSpan(source="went")],
                ),
                ValidSpan(source=" "),
                MistakeSpan(
                    category="preposition",
                    source="store",
                    reason=("English needs 'to the' before this destination noun. "),
                    target=[ValidSpan(source="to the store")],
                ),
            ],
        ),
        ValidSpan(source="."),
    ],
)


# ---- Example 3 input/output -----------------------------------------------

EXAMPLE_3 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="Blargle the gates!",
            next=[],
        ),
    ),
    response=[
        ErrorSpan(
            type="error",
            source="Blargle",
            category="unclear",
            reason="Not a valid English word, and the meaning is unclear.'",
        ),
        ValidSpan(source=" the gates!"),
    ],
)

EXAMPLE_4 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="fr-FR", interface="en-GB"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="I went to the blue yesterday.",
            next=[],
        ),
    ),
    response=[
        ErrorSpan(
            type="error",
            source="I went to the blue yesterday.",
            category="unexpected_language",
            reason=("This text is in English, not French."),
        )
    ],
)


# ---- Example 5 input/output -----------------------------------------------

EXAMPLE_5 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="I left the station because it suplexed the gardener.",
            next=[],
        ),
    ),
    response=[
        ValidSpan(source="I left the station because it "),
        ErrorSpan(
            type="error",
            source="suplexed",
            category="unclear",
            reason=(
                "Does not agree with the subject. A 'station' cannot perform a suplex."
            ),
        ),
        ValidSpan(source="."),
    ],
)


EXAMPLE_6 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[],
            current="You filthy cracker.",
            next=[],
        ),
    ),
    response=[
        ErrorSpan(
            type="error",
            source="You filthy [slur].",
            category="offensive",
            reason="Contains offensive language.",
        )
    ],
)


# ---- Example 7 input/output -----------------------------------------------

EXAMPLE_7 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=["Steve went to"],
            current="the store",
            next=[],
        ),
    ),
    response=[
        ErrorSpan(
            type="error",
            source="the store",
            category="unclear",
            reason=(
                "This is a noun phrase, not a complete paragraph. Combine it with "
                "the previous paragraph."
            ),
        )
    ],
)


# ---- Example 8 input/output -----------------------------------------------

EXAMPLE_8 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=["The World Health Organization is a truly great organization."],
            current="Lots of physicists work there.",
            next=[],
        ),
    ),
    response=[
        ValidSpan(source="Lots of "),
        MistakeSpan(
            category="word-choice",
            source="physicists",
            reason=(
                "'Physicists' are scientists who study physics. 'Physicians' work in medicine."
            ),
            target=[ValidSpan(source="physicians")],
        ),
        ValidSpan(source=" work there."),
    ],
)


# ---- Example 9 input/output -----------------------------------------------

EXAMPLE_9 = ExampleRequestResponsePair(
    request=CheckRequest(
        language=LanguageSpec(input="en-US", interface="en-US"),
        input=ParagraphCorrectionRequest(
            previous=[
                "We went to the garden.",
                "The garden was full of bees.",
            ],
            current="They bit me terribly and the flour smelled awful.",
            next=[],
        ),
    ),
    response=[
        ValidSpan(source="They "),
        MistakeSpan(
            category="word-choice",
            source="bit",
            reason="Bees sting; they do not bite.",
            target=[ValidSpan(source="stung")],
        ),
        ValidSpan(source=" me terribly and the "),
        MistakeSpan(
            category="word-choice",
            source="flour",
            reason=(
                "Likely meant 'flowers' given the context of the garden and bees. 'Flour' is a cooking ingredient and does not fit the context."
            ),
            target=[ValidSpan(source="flowers")],
        ),
        ValidSpan(source=" smelled awful."),
    ],
)


def get_example_history() -> MessageHistory:
    return MessageHistory(
        example_messages=[
            message
            for example in [
                EXAMPLE_1,
                EXAMPLE_2,
                EXAMPLE_3,
                EXAMPLE_4,
                EXAMPLE_5,
                EXAMPLE_6,
                EXAMPLE_7,
                EXAMPLE_8,
                EXAMPLE_9,
            ]
            for message in example.make_example_messages()
        ]
    )

"""Factory for pydantic-ai grammar-checking agents.

Usage::

    from agent.agent import get_agent

    agent = get_agent(model)
    result = await agent.run(...)
"""

from __future__ import annotations

from pydantic_ai import Agent

from config import config
from .models import ParagraphCorrectionResponse
from .prompt import SYSTEM_PROMPT


def get_agent(model: str) -> Agent[None, ParagraphCorrectionResponse]:
    """Build a grammar-checking ``Agent`` for the given *model* string."""
    return Agent(
        model,
        output_type=ParagraphCorrectionResponse,  # type: ignore[arg-type]
        system_prompt=SYSTEM_PROMPT,
        model_settings={"timeout": config.mistakes_timeout},
    )

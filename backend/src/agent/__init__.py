"""Grammar-checking agent package.

Public surface
--------------
``get_agent``   — lazy accessor for the singleton pydantic-ai ``Agent``.
``CheckRequest``/``CheckResponse`` — Pydantic models for agent I/O.
``MessageHistory`` — few-shot message history for use with ``agent.run()``.
"""

from .agent import get_agent
from .inference_service import ApiKeyManager, InferenceService
from .models import CheckRequest, ParagraphCorrectionResponse, check_response_adapter
from .prompt import SYSTEM_PROMPT, get_example_history, MessageHistory

__all__ = [
    "get_agent",
    "ApiKeyManager",
    "InferenceService",
    "CheckRequest",
    "ParagraphCorrectionResponse",
    "check_response_adapter",
    "MessageHistory",
    "get_example_history",
    "SYSTEM_PROMPT",
]

"""Environment variable configuration parsed lazily on first access.

All variables are prefixed with ``TY_`` (Teach Yourself).
"""

from __future__ import annotations

import functools
import os
from pathlib import Path

# from dotenv import load_dotenv

# load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class ProgramVars:
    """Parsed environment variables for the Teach Yourself backend.

    Attributes are resolved from the environment on first access and cached.
    """

    @staticmethod
    def _read_bool(name: str, default: bool = False) -> bool:
        value = os.environ.get(name)
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    @functools.cached_property
    def mistakes_timeout(self) -> int:
        """Timeout in seconds for the mistakes model (TY_MISTAKES_TIMEOUT)."""
        return int(os.environ.get("TY_MISTAKES_TIMEOUT", "30"))

    @functools.cached_property
    def port(self) -> int:
        """Port the server listens on (TY_PORT)."""
        return int(os.environ.get("TY_PORT", "8888"))

    @functools.cached_property
    def host(self) -> str:
        """Host the server binds to (TY_HOST)."""
        return os.environ.get("TY_HOST", "localhost")

    @functools.cached_property
    def cors_origins(self) -> list[str]:
        """Frontend origins allowed to call the API (TY_CORS_ORIGINS)."""
        raw_origins = os.environ.get(
            "TY_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        )
        return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    @functools.cached_property
    def db_path(self) -> str:
        """Path to the SQLite database file (TY_DB_PATH)."""
        default = str(Path(__file__).resolve().parent.parent / ".state" / "db.sqlite")
        return os.environ.get("TY_DB_PATH", default)

    @functools.cached_property
    def dev_truncate_db(self) -> bool:
        """Whether startup should delete and recreate the SQLite database."""
        return self._read_bool("TY_DEV_TRUNCATE_DB")

    @functools.cached_property
    def api_keys_file(self) -> Path:
        """Path to the YAML file containing inference provider API keys."""
        return Path(os.environ["TY_KEYS_FILE"]).expanduser().resolve()


config = ProgramVars()

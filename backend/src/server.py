"""FastAPI app entry point.

Run with::

    poetry run uvicorn server:app --reload
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse, Response

from api import router
from config import config
from db import get_user

_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app = FastAPI(
    title="Teach Yourself – Journal API",
    version="0.2.0",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class _AuthMiddleware(BaseHTTPMiddleware):
    """Parse the Authorization header as a user id, query the data layer, embed the user in state."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        path = request.url.path
        if (
            request.method == "OPTIONS"
            or not path.startswith("/api/")
            or path == "/api/login"
        ):
            return await call_next(request)

        auth = request.headers.get("Authorization", "").strip()
        try:
            user_id = int(auth)
        except ValueError:
            return JSONResponse({"detail": "Forbidden"}, status_code=403)

        user = await get_user(user_id)
        if user is None:
            return JSONResponse({"detail": "Forbidden"}, status_code=403)

        request.state.user = user
        return await call_next(request)


app.add_middleware(_AuthMiddleware)

app.include_router(router)


@app.get("/", include_in_schema=False)
async def serve_frontend_index() -> Response:
    if not _FRONTEND_DIST.exists():
        return PlainTextResponse(
            "Frontend build not found. Run `yarn build` in ./frontend first.",
            status_code=503,
        )

    return FileResponse(_FRONTEND_DIST / "index.html")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend_path(full_path: str) -> Response:
    if full_path.startswith("api/"):
        return PlainTextResponse("Not found", status_code=404)

    if not _FRONTEND_DIST.exists():
        return PlainTextResponse(
            "Frontend build not found. Run `yarn build` in ./frontend first.",
            status_code=503,
        )

    candidate = (_FRONTEND_DIST / full_path).resolve()
    if candidate.is_file() and _FRONTEND_DIST in candidate.parents:
        return FileResponse(candidate)

    return FileResponse(_FRONTEND_DIST / "index.html")

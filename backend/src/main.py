from __future__ import annotations

import uvicorn


def start() -> None:
    uvicorn.run("server:app", reload=True, port=8888)


if __name__ == "__main__":
    start()

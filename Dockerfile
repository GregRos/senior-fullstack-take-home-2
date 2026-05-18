FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
COPY frontend/.yarn ./.yarn

RUN corepack enable && yarn install --immutable

COPY frontend/ ./

ARG VITE_SERVER_URL=
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

RUN yarn build


FROM python:3.13-slim AS backend-base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_VERSION=2.2.1

RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"

WORKDIR /app/backend

COPY backend/pyproject.toml backend/poetry.lock backend/README.md ./


FROM backend-base AS backend-test

RUN poetry install --with dev --no-root

COPY backend/src ./src
COPY backend/tests ./tests

RUN poetry install --only-root
RUN poetry run test


FROM backend-base AS app

RUN poetry install --only main --no-root

COPY backend/src ./src
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/backend/.state

ENV TY_HOST=0.0.0.0 \
    TY_PORT=8888 \
    TY_DB_PATH=/app/backend/.state/db.sqlite

EXPOSE 8888

WORKDIR /app/backend/src
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8888"]
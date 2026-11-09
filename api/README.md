# Moneyflow API

FastAPI backend for Moneyflow. It verifies Firebase ID tokens on every request,
enforces per-user rate limits, and talks to Gemini on the user's behalf. All
money math lives in deterministic code; the AI only explains and suggests.

## Run locally

```bash
uv sync
cp .env.example .env
uv run uvicorn moneyflow_api.main:app --reload --port 8080
```

Open http://localhost:8080/api/health and http://localhost:8080/api/docs.

## Quality gates

```bash
uv run ruff check . && uv run ruff format --check .
uv run mypy .
uv run pytest
```

## Docker

```bash
docker build -t moneyflow-api .
docker run --rm -p 8080:8080 --env-file .env moneyflow-api
```

The container listens on `PORT` (default 8080), which is what Cloud Run injects.

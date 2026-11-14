FROM ghcr.io/astral-sh/uv:0.12.3 AS uv

FROM python:3.12-slim AS builder
WORKDIR /build
COPY --from=uv /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
COPY services/api/src services/api/src
RUN uv sync --frozen --no-dev --no-editable

FROM builder AS test
ENV PATH="/build/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
# rasterio wheels need libexpat at import time in the slim image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
RUN uv sync --frozen --group science --no-editable
COPY alembic.ini ./
COPY services/api/migrations services/api/migrations
COPY tests tests
COPY scripts scripts
COPY services/workers services/workers
COPY data/fixtures data/fixtures
CMD ["python", "-m", "pytest", "-q"]

FROM python:3.12-slim AS runtime
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN groupadd --gid 10001 cocha && useradd --uid 10001 --gid cocha --create-home cocha
COPY --from=builder /build/.venv /app/.venv
COPY alembic.ini ./
COPY services/api/migrations services/api/migrations
USER cocha
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "cocha_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

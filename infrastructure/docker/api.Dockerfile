FROM python:3.12-slim AS builder
WORKDIR /build
COPY pyproject.toml uv.lock ./
COPY services/api/src services/api/src
RUN pip install --no-cache-dir uv==0.12.3 && uv sync --frozen --no-dev --no-editable

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

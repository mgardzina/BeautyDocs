FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /srv/api

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY app ./app
RUN uv sync --locked --no-dev --no-editable

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/srv/api/.venv/bin:$PATH"

WORKDIR /srv/api

RUN addgroup --system beautydocs \
    && adduser --system --ingroup beautydocs --home /nonexistent beautydocs

COPY --from=builder /srv/api/.venv ./.venv
COPY --from=builder /srv/api/app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts

RUN mkdir -p /srv/api/.data/chat-attachments \
    && chown -R beautydocs:beautydocs /srv/api/.data

USER beautydocs
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1"]

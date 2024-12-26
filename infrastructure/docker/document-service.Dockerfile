# Build stage
FROM python:3.11-slim AS builder

# Set build-time environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.6.0 \
    POETRY_HOME=/opt/poetry \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache \
    WORKDIR=/app

# Set working directory
WORKDIR ${WORKDIR}

# Install system dependencies and security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        libmagic1 \
        clamav \
        clamav-daemon && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s ${POETRY_HOME}/bin/poetry /usr/local/bin/poetry

# Copy dependency specifications
COPY pyproject.toml poetry.lock ./

# Install production dependencies only
RUN poetry install --only main --no-root

# Copy application source code
COPY src/ ./src/

# Install application in production mode
RUN poetry install --only main

# Remove unnecessary build artifacts
RUN rm -rf ${POETRY_CACHE_DIR} && \
    find . -type d -name __pycache__ -exec rm -r {} +

# Final stage
FROM python:3.11-slim

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKDIR=/app

# Set working directory
WORKDIR ${WORKDIR}

# Install runtime dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        curl \
        libmagic1 \
        clamav \
        clamav-daemon && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    # Create non-root user
    groupadd -r nonroot --gid=65532 && \
    useradd -r -g nonroot --uid=65532 nonroot && \
    # Update ClamAV database
    freshclam

# Copy installed dependencies from builder stage
COPY --from=builder ${WORKDIR}/.venv ${WORKDIR}/.venv
COPY --from=builder ${WORKDIR}/src ${WORKDIR}/src

# Set ownership and permissions
RUN chown -R nonroot:nonroot ${WORKDIR} && \
    chmod -R 755 ${WORKDIR}

# Switch to non-root user
USER nonroot

# Add virtual environment to path
ENV PATH="${WORKDIR}/.venv/bin:$PATH"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:${PORT}/health || exit 1

# Expose application port
EXPOSE ${PORT}

# Set resource limits
ENV MEMORY="512M" \
    MEMORY_RESERVATION="256M" \
    CPU_SHARES=1024 \
    PIDS_LIMIT=100

# Set security options
LABEL org.opencontainers.image.source="https://github.com/organization/enrollment-system" \
      org.opencontainers.image.description="Document Service for Enrollment System" \
      org.opencontainers.image.version="1.0.0"

# Drop all capabilities and only add necessary ones
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/python3.11

# Configure logging
ENV PYTHONLOGGING='{"version": 1, "disable_existing_loggers": false, "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}}, "formatters": {"json": {"class": "pythonjsonlogger.jsonlogger.JsonFormatter"}}, "root": {"handlers": ["console"], "level": "INFO"}}'

# Start application with production server
CMD ["python", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
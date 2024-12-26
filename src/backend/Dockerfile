# Stage 1: TypeScript Builder
FROM node:18-alpine AS ts-builder
LABEL maintainer="Enrollment System Team"
LABEL description="Multi-stage build for Enrollment System Backend Services"

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files for layer caching
COPY package*.json lerna.json ./
COPY packages/*/package.json ./packages/

# Install dependencies with specific versions from package.json
RUN npm ci --only=production

# Copy source code and configs
COPY . .

# Build TypeScript services
RUN npm run build

# Remove dev dependencies and build artifacts
RUN npm prune --production

# Stage 2: Java Builder
FROM maven:3.9-eclipse-temurin-17-alpine AS java-builder

WORKDIR /app

# Copy Maven configuration
COPY pom.xml .
COPY packages/*/pom.xml ./packages/

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code
COPY . .

# Build Java services
RUN mvn package -DskipTests

# Stage 3: Python Builder
FROM python:3.11-slim AS python-builder

WORKDIR /app

# Copy requirements files
COPY packages/document-service/requirements.txt ./

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get remove -y gcc python3-dev && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy source code
COPY packages/document-service ./

# Stage 4: Final Runtime Image
FROM node:18-alpine AS runtime

# Install security updates and basic tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache tini curl tzdata && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy built artifacts from previous stages
COPY --from=ts-builder /app/dist ./dist
COPY --from=ts-builder /app/node_modules ./node_modules
COPY --from=java-builder /app/target/libs ./libs
COPY --from=python-builder /app/dist ./python-dist

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    GRPC_PORT=50051 \
    TZ=UTC

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose ports
EXPOSE ${PORT} ${GRPC_PORT}

# Configure volumes
VOLUME ["/app/logs", "/app/data"]

# Set security options
LABEL org.label-schema.schema-version="1.0" \
      org.label-schema.name="enrollment-system-backend" \
      org.label-schema.vendor="Enrollment System" \
      org.label-schema.version="1.0.0" \
      security.capabilities="{\"drop\":[\"ALL\"]}" \
      security.read-only="true"

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/packages/api-gateway/src/index.js"]

# Enable Prometheus metrics
LABEL prometheus.path="/metrics" \
      prometheus.port="${PORT}"

# Configure logging
LABEL logging.driver="json-file" \
      logging.options.max-size="100m" \
      logging.options.max-file="5"
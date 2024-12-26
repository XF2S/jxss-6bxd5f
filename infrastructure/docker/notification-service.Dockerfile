# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Create non-root user
RUN addgroup -S notifier && adduser -S notifier -G notifier

# Copy package files
COPY --chown=notifier:notifier package*.json ./
COPY --chown=notifier:notifier tsconfig.json ./

# Install dependencies with exact versions
RUN npm ci && \
    # Run security audit
    npm audit && \
    # Clean npm cache
    npm cache clean --force

# Copy source code
COPY --chown=notifier:notifier . .

# Run TypeScript build with optimizations
RUN npm run build && \
    # Remove source maps for production
    find ./dist -name "*.js.map" -type f -delete

# Stage 2: Production
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Add system dependencies
RUN apk add --no-cache \
    netcat-openbsd \
    tzdata \
    curl

# Create non-root user
RUN addgroup -S notifier && adduser -S notifier -G notifier

# Set environment variables
ENV NODE_ENV=production \
    GRPC_PORT=50051 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    TZ=UTC

# Copy package files
COPY --chown=notifier:notifier package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --chown=notifier:notifier --from=builder /usr/src/app/dist ./dist

# Security hardening
RUN chmod -R 550 /usr/src/app && \
    chmod -R 770 /usr/src/app/dist && \
    chown -R notifier:notifier /usr/src/app

# Expose ports for gRPC and metrics
EXPOSE 50051 9090

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD nc -z localhost 50051 || exit 1

# Switch to non-root user
USER notifier

# Start notification service
CMD ["node", "dist/app.js"]
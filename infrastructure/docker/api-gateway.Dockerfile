# Stage 1: Builder
FROM node:20-alpine AS builder

# Security: Create non-root user
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

# Set working directory and permissions
WORKDIR /app
RUN chown nodeuser:nodegroup /app

# Copy package files with proper permissions
COPY --chown=nodeuser:nodegroup package*.json ./

# Install dependencies using npm ci for deterministic builds
RUN npm ci --no-optional && \
    # Security audit
    npm run security:audit && \
    # Clean npm cache
    npm cache clean --force

# Copy source code with appropriate ownership
COPY --chown=nodeuser:nodegroup . .

# Build TypeScript code with optimizations
RUN npm run build && \
    # Compress node_modules
    tar czf node_modules.tar.gz node_modules && \
    rm -rf node_modules && \
    # Clean development artifacts
    rm -rf src tests coverage .git

# Stage 2: Production
FROM node:20-alpine

# Security: Create non-root user
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

# Set working directory with proper permissions
WORKDIR /app
RUN chown nodeuser:nodegroup /app

# Copy package files and built artifacts from builder
COPY --from=builder --chown=nodeuser:nodegroup /app/package*.json ./
COPY --from=builder --chown=nodeuser:nodegroup /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodegroup /app/node_modules.tar.gz ./

# Install production dependencies only
RUN npm ci --only=production --no-optional && \
    # Extract compressed node_modules
    tar xzf node_modules.tar.gz && \
    rm node_modules.tar.gz && \
    # Clean npm cache
    npm cache clean --force

# Security hardening
RUN apk add --no-cache curl && \
    # Remove unnecessary files
    rm -rf /var/cache/apk/* && \
    # Set proper permissions
    chmod -R 555 /app/dist && \
    chmod -R 555 /app/node_modules

# Configure environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    COMPRESSION_ENABLED=true

# Switch to non-root user
USER nodeuser

# Expose ports
EXPOSE 3000 9090

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Configure proper logging
ENV NODE_OPTIONS="$NODE_OPTIONS --enable-source-maps"

# Start application
CMD ["node", "dist/app.js"]

# Metadata labels
LABEL maintainer="Enrollment System Team" \
      version="1.0.0" \
      description="API Gateway service for enrollment system" \
      security.credentials="nodeuser:nodegroup" \
      org.opencontainers.image.source="https://github.com/enrollment-system/api-gateway" \
      org.opencontainers.image.vendor="Enrollment System" \
      org.opencontainers.image.title="API Gateway" \
      org.opencontainers.image.description="API Gateway service container" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.created="2023-09-20"
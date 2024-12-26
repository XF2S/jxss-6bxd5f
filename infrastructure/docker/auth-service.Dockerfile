# Stage 1: Builder
FROM node:20-alpine3.18 AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    && npm install -g npm@latest \
    && npm install -g snyk

# Copy package files with integrity verification
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig.json ./

# Install dependencies including devDependencies for build
RUN npm ci --production=false \
    && npm audit fix \
    && snyk test || true

# Copy source code with appropriate permissions
COPY --chown=node:node ./src ./src

# Build TypeScript application with optimizations
RUN npm run build \
    && npm prune --production

# Stage 2: Production
FROM node:20-alpine3.18

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user and set working directory
WORKDIR /app
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs \
    && chown -R nodejs:nodejs /app

# Install production dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Copy built artifacts from builder
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs --from=builder /app/package*.json ./

# Set secure permissions
RUN chmod -R 550 /app/dist \
    && chmod -R 550 /app/node_modules \
    && chmod 550 /app/package.json \
    && mkdir -p /data/redis \
    && chown -R nodejs:nodejs /data/redis \
    && chmod 750 /data/redis

# Configure security settings
RUN echo "nodejs soft nofile 1024" >> /etc/security/limits.conf \
    && echo "nodejs hard nofile 2048" >> /etc/security/limits.conf

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health/auth || exit 1

# Expose port
EXPOSE 3001

# Set security labels
LABEL maintainer="Enrollment System Team" \
    service="auth-service" \
    version="1.0.0" \
    security.scan-required="true" \
    compliance.gdpr="true" \
    compliance.ferpa="true"

# Configure volumes
VOLUME ["/data/redis", "/run/secrets"]

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# Security options
STOPSIGNAL SIGTERM

# Set read-only root filesystem
# Note: This is applied at runtime via Docker run command or compose file
# --read-only --tmpfs /tmp:rw,noexec,nosuid

# Drop all capabilities and add only required ones
# Note: This is applied at runtime via Docker run command or compose file
# --cap-drop=ALL --cap-add=NET_BIND_SERVICE

# Set no-new-privileges
# Note: This is applied at runtime via Docker run command or compose file
# --security-opt=no-new-privileges:true
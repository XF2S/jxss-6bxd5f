# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Add labels for build stage
LABEL stage=builder \
      maintainer="Enrollment System Team" \
      version="1.0.0"

# Install build dependencies and security updates
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl && \
    rm -rf /var/cache/apk/*

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with specific version constraints from package.json
RUN npm ci --production=false && \
    npm cache clean --force

# Copy source code and configuration files
COPY . .

# Set production environment
ENV NODE_ENV=production \
    VITE_API_BASE_URL=${API_BASE_URL}

# Build application with optimizations from vite.config.ts
RUN npm run build && \
    npm run analyze

# Clean up build dependencies
RUN npm prune --production && \
    rm -rf /root/.npm /root/.node-gyp

# Stage 2: Production
FROM nginx:1.25-alpine

# Add labels
LABEL maintainer="Enrollment System Team" \
      version="1.0.0" \
      description="Enrollment System Web Frontend" \
      security.hardened="true" \
      performance.optimized="true"

# Install required packages and security updates
RUN apk update && \
    apk add --no-cache \
    curl \
    tzdata && \
    rm -rf /var/cache/apk/*

# Create nginx user and group with minimal privileges
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set up security headers and CSP
RUN echo 'add_header X-Frame-Options "DENY";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header Referrer-Policy "strict-origin-when-cross-origin";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\'';";' >> /etc/nginx/conf.d/security-headers.conf

# Configure nginx
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Set up health check endpoint
RUN echo "location /health { return 200 'healthy\n'; }" > /etc/nginx/conf.d/health.conf

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Set security options
STOPSIGNAL SIGQUIT
ENTRYPOINT ["nginx", "-g", "daemon off;"]

# Apply security configurations
SECURITY_OPTS --security-opt=no-new-privileges:true \
             --security-opt=seccomp=unconfined \
             --cap-drop=ALL

# Set read-only filesystem
VOLUME ["/etc/nginx/conf.d", "/var/log/nginx"]
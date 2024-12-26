# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Add package management files
COPY package*.json ./

# Install dependencies with strict security and performance settings
RUN apk add --no-cache python3 make g++ \
    && npm ci --production=false \
    && npm cache clean --force

# Copy source files
COPY . .

# Set build arguments
ARG NODE_ENV=production
ARG API_URL
ARG BUILD_VERSION

# Set environment variables
ENV NODE_ENV=${NODE_ENV} \
    VITE_API_BASE_URL=${API_URL}

# Build application with optimizations
RUN npm run build \
    && npm prune --production

# Stage 2: Production
FROM nginx:1.25-alpine

# Add nginx user and group first to ensure correct permissions
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx

# Install additional security packages
RUN apk add --no-cache curl tzdata

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set environment variables for nginx
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# Security headers configuration
RUN echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/security-headers.conf \
    && echo 'add_header X-Frame-Options "DENY";' >> /etc/nginx/conf.d/security-headers.conf \
    && echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security-headers.conf \
    && echo 'add_header Referrer-Policy "strict-origin-when-cross-origin";' >> /etc/nginx/conf.d/security-headers.conf \
    && echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\''; style-src '\''self'\'' '\''unsafe-inline'\'';";' >> /etc/nginx/conf.d/security-headers.conf \
    && echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";' >> /etc/nginx/conf.d/security-headers.conf

# Create required directories with correct permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Configure health check endpoint
RUN echo "health_check" > /usr/share/nginx/html/health

# Expose port
EXPOSE 80

# Set up volumes
VOLUME ["/var/cache/nginx", "/var/log/nginx"]

# Set metadata labels
LABEL maintainer="Enrollment System Team" \
      description="Web frontend for Enrollment System" \
      version="1.0.0" \
      build_date="${BUILD_DATE}" \
      vcs_ref="${VCS_REF}" \
      vendor="Educational Institution"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Switch to non-root user
USER nginx

# Use exec form for better signal handling
CMD ["nginx", "-g", "daemon off;"]

# Security options
SECURITY_OPT --no-new-privileges:true \
             --cap-drop=ALL \
             --cap-add=NET_BIND_SERVICE \
             --read-only \
             --security-opt=seccomp=unconfined

# Set working directory to nginx html directory
WORKDIR /usr/share/nginx/html
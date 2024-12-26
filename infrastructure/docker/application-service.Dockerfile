# Build Stage
# maven:3.9-eclipse-temurin-17-alpine v3.9.3
FROM maven:3.9-eclipse-temurin-17-alpine AS build

# Set working directory for build
WORKDIR /build

# Copy pom.xml first for dependency caching
COPY pom.xml .

# Download dependencies and create layer cache
RUN mvn dependency:go-offline -B

# Copy source code (respect .dockerignore)
COPY src ./src/

# Build application in production mode
RUN mvn clean package -DskipTests -Pproduction \
    && mkdir -p target/dependency \
    && cd target/dependency \
    && jar -xf ../*.jar

# Runtime Stage
# eclipse-temurin:17-jre-alpine v17.0.7
FROM eclipse-temurin:17-jre-alpine

# Add labels for container metadata
LABEL maintainer="Enrollment System Team" \
      application="application-service" \
      version="1.0.0"

# Create non-root user/group
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Create directories with proper permissions
RUN mkdir -p /app/logs /tmp/app && \
    chown -R appuser:appgroup /app /tmp/app

# Copy application artifacts from build stage
COPY --from=build --chown=appuser:appgroup /build/target/dependency/BOOT-INF/lib /app/lib
COPY --from=build --chown=appuser:appgroup /build/target/dependency/META-INF /app/META-INF
COPY --from=build --chown=appuser:appgroup /build/target/dependency/BOOT-INF/classes /app/classes

# Set environment variables
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/logs" \
    TZ="UTC" \
    SERVER_PORT="8081" \
    SPRING_PROFILES_ACTIVE="production"

# Expose application port
EXPOSE 8081

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --quiet --tries=1 --spider http://localhost:8081/actuator/health || exit 1

# Switch to non-root user
USER appuser:appgroup

# Set security options
RUN chmod -R 550 /app/classes /app/lib && \
    chmod -R 770 /app/logs /tmp/app

# Define entry point with security options
ENTRYPOINT [ "sh", "-c", \
    "java $JAVA_OPTS \
    -Djava.security.egd=file:/dev/./urandom \
    -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE} \
    -Dserver.port=${SERVER_PORT} \
    -cp /app/classes:/app/lib/* \
    com.enrollment.application.Application" \
]

# Configure volumes for persistence
VOLUME ["/app/logs", "/tmp/app"]

# Security hardening
STOPSIGNAL SIGTERM

# Additional security options
SECURITY_OPTS --cap-drop=ALL --security-opt=no-new-privileges:true --read-only
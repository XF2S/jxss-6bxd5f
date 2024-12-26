# Stage 1: Build environment
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

# Set working directory
WORKDIR /build

# Copy Maven configuration
COPY pom.xml .
COPY .mvn/ .mvn/

# Download dependencies and cache them
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ src/

# Build application with optimized settings
RUN mvn clean package -DskipTests \
    -Dmaven.compiler.source=17 \
    -Dmaven.compiler.target=17 \
    -Dmaven.test.skip=true \
    -Dspring.profiles.active=prod

# Verify build artifacts
RUN ls -la target/*.jar

# Stage 2: Runtime environment
FROM eclipse-temurin:17-jre-alpine

# Add labels for container metadata
LABEL maintainer="Enrollment System Team" \
      application="workflow-service" \
      version="1.0.0"

# Create non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring

# Set working directory
WORKDIR /app

# Copy JAR from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Set appropriate permissions
RUN chown -R spring:spring /app && \
    chmod 550 /app && \
    chmod 440 app.jar

# Create and set permissions for volumes
RUN mkdir -p /app/logs /tmp/workflow-service && \
    chown -R spring:spring /app/logs /tmp/workflow-service && \
    chmod 770 /app/logs /tmp/workflow-service

# Configure security options
RUN apk add --no-cache dumb-init tzdata && \
    rm -rf /var/cache/apk/*

# Switch to non-root user
USER spring:spring

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8085 \
    GRPC_PORT=50055 \
    JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:InitialRAMPercentage=50.0 \
               -XX:+UseG1GC \
               -XX:+HeapDumpOnOutOfMemoryError \
               -XX:HeapDumpPath=/app/logs/heapdump.hprof \
               -XX:+ExitOnOutOfMemoryError \
               -Djava.security.egd=file:/dev/./urandom \
               -Duser.timezone=UTC"

# Expose ports
EXPOSE 8085 50055

# Define volumes
VOLUME ["/app/logs", "/tmp/workflow-service"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8085/actuator/health || exit 1

# Set entry point with dumb-init for proper process management
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Define the command to run the application
CMD ["java", \
     "-jar", \
     "/app/app.jar"]
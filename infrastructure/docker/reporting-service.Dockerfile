# Stage 1: Build stage
# Using Maven with Eclipse Temurin JDK 17 Alpine base image
# v3.9-eclipse-temurin-17-alpine
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

# Set working directory
WORKDIR /build

# Copy Maven configuration files first to cache dependencies
COPY src/backend/packages/reporting-service/pom.xml .
COPY src/backend/packages/reporting-service/.mvn .mvn

# Download dependencies (this layer will be cached)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/backend/packages/reporting-service/src ./src

# Build application with production profile
RUN mvn clean package -DskipTests -Pprod \
    && mkdir -p target/dependency \
    && cd target/dependency \
    && jar -xf ../*.jar

# Stage 2: Runtime stage
# Using Eclipse Temurin JRE 17 Alpine base image for minimal runtime
# v17-jre-alpine
FROM eclipse-temurin:17-jre-alpine

# Add labels for container metadata
LABEL maintainer="Enrollment System Team" \
      service="reporting-service" \
      version="1.0.0" \
      description="Reporting service for generating reports and analytics" \
      base.image="eclipse-temurin:17-jre-alpine" \
      java.version="17"

# Create non-root user and group
RUN addgroup -S ${REPORTING_SERVICE_GROUP:-reporting} && \
    adduser -S ${REPORTING_SERVICE_USER:-reporting} -G ${REPORTING_SERVICE_GROUP:-reporting}

# Set working directory
WORKDIR /app

# Copy application from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Set file ownership and permissions
RUN chown -R ${REPORTING_SERVICE_USER:-reporting}:${REPORTING_SERVICE_GROUP:-reporting} /app && \
    chmod 550 /app/app.jar

# Set timezone
ENV TZ=UTC

# Configure JVM options for production
ENV JAVA_OPTS="-Xms512m -Xmx1024m \
    -XX:+UseG1GC \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:+UseStringDeduplication \
    -Djava.security.egd=file:/dev/./urandom"

# Set Spring profile
ENV SPRING_PROFILES_ACTIVE=prod

# Expose service port
EXPOSE 8085

# Switch to non-root user
USER ${REPORTING_SERVICE_USER:-reporting}

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8085/actuator/health || exit 1

# Set entry point
ENTRYPOINT ["java", ${JAVA_OPTS}, "-jar", "app.jar"]
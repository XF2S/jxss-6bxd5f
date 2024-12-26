# Enrollment System Backend

## Overview

The Enrollment System Backend is a comprehensive microservices-based architecture designed to handle educational enrollment processes. Built with enterprise-grade security, scalability, and maintainability in mind, it provides robust APIs for application processing, document management, and user authentication.

## Architecture

The system implements a modern microservices architecture with the following core services:

- **API Gateway** (Node.js/Express) - Central entry point handling routing and security
- **Application Service** (Java/Spring Boot) - Core enrollment processing logic
- **Document Service** (Python/FastAPI) - Secure document management
- **Auth Service** (Node.js) - Authentication and authorization
- **Notification Service** (Node.js) - Communication management

### Technology Stack

- **Runtime Environments**:
  - Node.js v20.5.1+
  - Java 17 (LTS)
  - Python 3.11+

- **Frameworks**:
  - Express.js v4.18.2
  - Spring Boot v3.1.0
  - FastAPI v0.100.0

- **Databases**:
  - PostgreSQL 14
  - MongoDB 6.0
  - Redis 7.0

- **Infrastructure**:
  - Docker v24+
  - Docker Compose v2.20+
  - AWS S3 (Document Storage)

## Prerequisites

1. Development Tools:
```bash
node >= 20.5.1
npm >= 9.0.0
java >= 17.0.0
python >= 3.11.0
docker >= 24.0.0
docker-compose >= 2.20.0
```

2. Environment Setup:
```bash
# Clone repository
git clone <repository-url>
cd enrollment-system/backend

# Install dependencies
npm install
lerna bootstrap

# Configure environment
cp .env.example .env
```

## Development Setup

1. Start Infrastructure Services:
```bash
docker-compose up -d postgres mongodb redis
```

2. Start Microservices:
```bash
# Development mode with hot reload
npm run dev

# Individual services
npm run dev --scope=api-gateway
npm run dev --scope=application-service
npm run dev --scope=document-service
```

3. Build Services:
```bash
# Build all services
npm run build

# Build specific service
npm run build --scope=api-gateway
```

## Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific service tests
npm run test --scope=api-gateway
```

## Security Implementation

1. Authentication:
   - JWT-based authentication
   - OAuth2/OpenID Connect support
   - MFA capability

2. Authorization:
   - Role-based access control (RBAC)
   - Fine-grained permissions
   - Resource-level authorization

3. Data Security:
   - AES-256-GCM encryption at rest
   - TLS 1.3 for data in transit
   - Secure document storage with AWS S3

## Monitoring & Observability

1. Metrics:
   - Prometheus metrics exposed on each service
   - Custom business metrics
   - SLA monitoring

2. Logging:
   - Structured JSON logging
   - ELK Stack integration
   - Log rotation and retention policies

3. Tracing:
   - Distributed tracing with Jaeger
   - Request correlation
   - Performance monitoring

## API Documentation

- API Gateway: http://localhost:3000/api/docs
- Application Service: http://localhost:8081/swagger-ui.html
- Document Service: http://localhost:8000/api/docs

## Contributing

1. Code Standards:
   - Follow language-specific style guides
   - Use provided linting configurations
   - Include comprehensive tests

2. Pull Request Process:
   - Create feature branch from develop
   - Include test coverage
   - Update documentation
   - Require peer review

## Deployment

1. Production Build:
```bash
# Build production artifacts
npm run build

# Build Docker images
docker-compose build
```

2. Container Registry:
```bash
# Tag images
docker tag api-gateway:latest <registry>/api-gateway:latest

# Push images
docker push <registry>/api-gateway:latest
```

## Environment Variables

Required environment variables for each service:

```bash
# API Gateway
PORT=3000
JWT_SECRET=<secret>
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Application Service
SPRING_PROFILES_ACTIVE=production
DB_HOST=postgres
DB_PORT=5432
DB_NAME=enrollment
DB_USER=<user>
DB_PASSWORD=<password>

# Document Service
MONGODB_URI=mongodb://mongodb:27017/enrollment_system
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=<region>
S3_BUCKET_NAME=<bucket>
```

## License

Proprietary - All rights reserved

## Support

For technical support and questions:
- Email: support@enrollmentsystem.com
- Documentation: https://docs.enrollmentsystem.com
# Changelog
All notable changes to the Enrollment System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
#### Backend Services
- [auth-service] Implement OIDC integration with institutional IdP #145 (#146)
- [document-service] Add virus scanning for uploaded documents #152 (#153)
- [workflow-service] Implement configurable approval workflows #158 (#159)

#### Frontend Application
- [web] Add dark mode support with system preference detection #160 (#161)
- [web] Implement document preview with secure viewer #165 (#166)

#### Infrastructure
- [monitoring] Add Grafana dashboards for service metrics #170 (#171)
- [kubernetes] Implement horizontal pod autoscaling #175 (#176)

#### Documentation
- [docs] Add API documentation with OpenAPI 3.0 specs #180 (#181)

### Changed
#### Backend Services
- [api-gateway] **BREAKING** Update rate limiting implementation #182 (#183)
- [application-service] Optimize database queries for large datasets #185 (#186)

#### Frontend Application
- [web] Improve accessibility compliance with WCAG 2.1 guidelines #190 (#191)

#### Infrastructure
- [terraform] Update AWS provider to latest version #195 (#196)

### Deprecated
#### Backend Services
- [notification-service] Legacy email templates will be removed in 2.0.0 #200 (#201)

### Security
- **SECURITY** [auth-service] Fix JWT validation vulnerability #205 (#206)
- **SECURITY** [api-gateway] Update dependencies with security patches #210 (#211)
- **COMPLIANCE** [document-service] Implement GDPR data retention policies #215 (#216)

## [1.0.0] - 2024-01-15

### Added
#### Backend Services
- [auth-service] Initial implementation of authentication service #100 (#101)
- [application-service] Core application processing functionality #105 (#106)
- [document-service] Document upload and management system #110 (#111)
- [notification-service] Email and SMS notification system #115 (#116)
- [reporting-service] Basic reporting capabilities #120 (#121)
- [workflow-service] Basic workflow management #125 (#126)

#### Frontend Application
- [web] Initial release of enrollment portal #130 (#131)
- [web] User dashboard and application forms #135 (#136)
- [web] Document upload interface #140 (#141)

#### Infrastructure
- [terraform] Initial AWS infrastructure setup #001 (#002)
- [kubernetes] Base cluster configuration #005 (#006)
- [monitoring] Basic monitoring and alerting #010 (#011)

### Security
- **SECURITY** [all] Initial security hardening #015 (#016)
- **COMPLIANCE** [all] FERPA compliance implementation #020 (#021)

[Unreleased]: https://github.com/organization/enrollment-system/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/organization/enrollment-system/releases/tag/v1.0.0

### Release Notes
- [Release Notes 1.0.0](https://github.com/organization/enrollment-system/releases/tag/v1.0.0)
- [Security Advisory](https://github.com/organization/enrollment-system/security/advisories)
- [Migration Guide](https://github.com/organization/enrollment-system/wiki/migration-guide-1.0.0)

### Component Versions
- Backend Services: 1.0.0
  - api-gateway: 1.0.0
  - auth-service: 1.0.0
  - application-service: 1.0.0
  - document-service: 1.0.0
  - notification-service: 1.0.0
  - reporting-service: 1.0.0
  - workflow-service: 1.0.0
- Frontend Application: 1.0.0
- Infrastructure: 1.0.0
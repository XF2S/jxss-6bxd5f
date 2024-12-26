<!-- 
Pull Request Template
Please fill in all required sections and check all applicable boxes.
PR will not be reviewed until template is properly completed.
-->

## Title
<!-- Follow format: type(scope): description -->
<!-- Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, security -->
<!-- Example: feat(auth): implement MFA for admin users -->

## Description

### Changes
<!-- Provide detailed technical explanation of the changes -->
<!-- Minimum 50 characters required -->

### Motivation
<!-- Explain business context and technical rationale -->
<!-- Minimum 50 characters required -->

### Related Issues
<!-- Link to JIRA tickets or GitHub issues -->
<!-- Format: [TYPE-123](url) - relationship -->
<!-- Example: [ENROLL-123](url) - implements -->

## Type of Change
<!-- Check all that apply -->
- [ ] New feature (non-breaking)
- [ ] Bug fix (non-breaking)
- [ ] Breaking change
- [ ] Performance improvement
- [ ] Security enhancement
- [ ] Documentation update
- [ ] Code style update
- [ ] Refactoring
- [ ] Test updates
- [ ] CI/CD changes
- [ ] Dependencies update

## Testing

<details>
<summary>Test Coverage</summary>

<!-- Provide details of test coverage -->
<!-- Include metrics from test runner -->
```
// Insert coverage report
```
</details>

<details>
<summary>Test Instructions</summary>

<!-- Step-by-step guide for testing -->
1. 
2. 
3. 

**Prerequisites:**
- 
</details>

<details>
<summary>Performance Impact</summary>

<!-- Include performance analysis -->
<!-- Add metrics and benchmarks -->
```
// Insert performance metrics
```
</details>

## Review Checklist
<!-- All applicable items must be checked before merge -->
- [ ] Code follows project style guidelines and linting rules
- [ ] API documentation updated (OpenAPI/Swagger)
- [ ] README and architecture documentation updated
- [ ] Unit tests added with >80% coverage
- [ ] Integration tests added for new features
- [ ] E2E tests updated for workflow changes
- [ ] Security scan passed (Snyk/SonarQube)
- [ ] Dependency vulnerabilities checked
- [ ] OWASP Top 10 considerations addressed
- [ ] Performance tested (load/stress tests)
- [ ] Breaking changes documented in CHANGELOG
- [ ] Database migrations are reversible
- [ ] Error handling follows pattern
- [ ] Logging added for critical operations
- [ ] Accessibility guidelines met
- [ ] i18n/l10n requirements addressed

## Deployment Notes

<details>
<summary>Configuration Changes</summary>

<!-- List all configuration changes required -->
```
// Insert config changes
```
</details>

<details>
<summary>Database Changes</summary>

<!-- Include migration and rollback procedures -->
**Migration:**
```sql
-- Insert migration SQL
```

**Rollback:**
```sql
-- Insert rollback SQL
```
</details>

<details>
<summary>Dependencies</summary>

<!-- List new/updated dependencies -->
```
package1: ^1.2.3
package2: ~2.3.4
```
</details>

<details>
<summary>Deployment Steps</summary>

1. 
2. 
3. 

**Verification Steps:**
1. 
2. 
</details>

<!-- 
Validation Rules:
1. Title must follow conventional commit format
2. Description sections require minimum 50 characters
3. At least one Type of Change must be selected
4. Testing sections must include evidence
5. All applicable Review Checklist items must be checked
6. Deployment Notes required for production changes
-->
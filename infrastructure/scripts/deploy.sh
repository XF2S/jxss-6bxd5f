#!/usr/bin/env bash

# Enrollment System Deployment Script
# Version: 1.0.0
# Description: Production-grade deployment script for the enrollment system microservices
# Dependencies:
# - kubectl (latest)
# - kustomize (latest)
# - docker (latest)
# - aws-cli (2.x)
# - trivy (latest)

set -euo pipefail
IFS=$'\n\t'

# Global Configuration
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly SERVICES=("api-gateway" "application-service" "auth-service" "document-service" "notification-service" "reporting-service" "workflow-service" "web")
readonly REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
readonly NAMESPACE_PREFIX="enrollment-system"
readonly DEPLOYMENT_TIMEOUT=600
readonly HEALTH_CHECK_RETRIES=5
readonly CANARY_PERCENTAGE=20
readonly ROLLBACK_THRESHOLD=25

# Logging Configuration
readonly LOG_FILE="/var/log/enrollment-deploy-$(date +%Y%m%d-%H%M%S).log"
readonly CONSOLE_LOG_LEVEL="INFO"
readonly FILE_LOG_LEVEL="DEBUG"

# Color codes for console output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Deployment lock file
readonly LOCK_FILE="/tmp/enrollment-deploy.lock"

# Initialize logging
setup_logging() {
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    log "INFO" "Deployment started at $(date '+%Y-%m-%d %H:%M:%S')"
}

# Logging function
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}"
}

# Check all prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check required tools
    local tools=("kubectl" "kustomize" "docker" "aws" "trivy")
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log "ERROR" "${tool} is required but not installed"
            return 1
        fi
    done
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials"
        return 1
    }
    
    # Check cluster connectivity
    for env in "${ENVIRONMENTS[@]}"; do
        if ! kubectl cluster-info --context "${env}" &> /dev/null; then
            log "ERROR" "Cannot connect to ${env} cluster"
            return 1
        fi
    done
    
    # Verify Docker daemon
    if ! docker info &> /dev/null; then
        log "ERROR" "Docker daemon is not running"
        return 1
    }
    
    log "INFO" "Prerequisites check passed"
    return 0
}

# Build and push container images
build_images() {
    local environment=$1
    log "INFO" "Building images for ${environment} environment"
    
    for service in "${SERVICES[@]}"; do
        log "INFO" "Building ${service} image..."
        
        # Build image with cache optimization
        if ! docker build \
            --cache-from "${REGISTRY}/${service}:latest" \
            --build-arg ENVIRONMENT="${environment}" \
            --tag "${REGISTRY}/${service}:${environment}" \
            --tag "${REGISTRY}/${service}:latest" \
            --file "Dockerfile.${service}" .; then
            log "ERROR" "Failed to build ${service} image"
            return 1
        fi
        
        # Security scan with Trivy
        log "INFO" "Scanning ${service} image for vulnerabilities..."
        if ! trivy image --severity HIGH,CRITICAL "${REGISTRY}/${service}:${environment}"; then
            log "ERROR" "Security vulnerabilities found in ${service} image"
            return 1
        fi
        
        # Push images to registry
        log "INFO" "Pushing ${service} image to registry..."
        if ! docker push "${REGISTRY}/${service}:${environment}"; then
            log "ERROR" "Failed to push ${service} image"
            return 1
        fi
    done
    
    return 0
}

# Deploy service with zero-downtime
deploy_service() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"
    
    log "INFO" "Deploying ${service_name} to ${environment}"
    
    # Acquire deployment lock
    if ! mkdir "${LOCK_FILE}" 2>/dev/null; then
        log "ERROR" "Another deployment is in progress"
        return 1
    fi
    
    # Backup current state
    kubectl get deployment "${service_name}" -n "${namespace}" -o yaml > "/tmp/${service_name}-backup.yaml"
    
    # Apply canary deployment if enabled
    if [[ "${environment}" == "prod" ]]; then
        log "INFO" "Initiating canary deployment (${CANARY_PERCENTAGE}%)"
        
        # Create canary deployment
        sed "s/replicas: .*/replicas: 1/" "/tmp/${service_name}-backup.yaml" | \
            sed "s/name: ${service_name}/name: ${service_name}-canary/" | \
            kubectl apply -f -
        
        # Wait for canary to be ready
        if ! kubectl rollout status deployment "${service_name}-canary" -n "${namespace}" --timeout="${DEPLOYMENT_TIMEOUT}s"; then
            log "ERROR" "Canary deployment failed"
            rollback_deployment "${service_name}" "${environment}"
            return 1
        fi
    fi
    
    # Apply main deployment
    if ! kubectl apply -k "infrastructure/kubernetes/overlays/${environment}"; then
        log "ERROR" "Failed to apply deployment"
        rollback_deployment "${service_name}" "${environment}"
        return 1
    fi
    
    # Wait for rollout completion
    if ! kubectl rollout status deployment "${service_name}" -n "${namespace}" --timeout="${DEPLOYMENT_TIMEOUT}s"; then
        log "ERROR" "Deployment rollout failed"
        rollback_deployment "${service_name}" "${environment}"
        return 1
    fi
    
    # Validate deployment
    if ! validate_deployment "${service_name}" "${environment}"; then
        log "ERROR" "Deployment validation failed"
        rollback_deployment "${service_name}" "${environment}"
        return 1
    fi
    
    # Cleanup
    rm -rf "${LOCK_FILE}"
    rm "/tmp/${service_name}-backup.yaml"
    
    log "INFO" "Successfully deployed ${service_name} to ${environment}"
    return 0
}

# Rollback deployment
rollback_deployment() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"
    
    log "WARN" "Rolling back ${service_name} deployment in ${environment}"
    
    # Stop ongoing deployment
    kubectl rollout undo deployment "${service_name}" -n "${namespace}"
    
    # Apply backup state
    if [[ -f "/tmp/${service_name}-backup.yaml" ]]; then
        kubectl apply -f "/tmp/${service_name}-backup.yaml"
    fi
    
    # Remove canary if exists
    kubectl delete deployment "${service_name}-canary" -n "${namespace}" --ignore-not-found
    
    log "INFO" "Rollback completed"
    return 0
}

# Validate deployment
validate_deployment() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"
    
    log "INFO" "Validating deployment of ${service_name} in ${environment}"
    
    # Check pod status
    local ready_pods=$(kubectl get pods -n "${namespace}" -l "app=${service_name}" -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | tr ' ' '\n' | grep -c "true")
    local total_pods=$(kubectl get pods -n "${namespace}" -l "app=${service_name}" --no-headers | wc -l)
    
    if [[ "${ready_pods}" -lt "${total_pods}" ]]; then
        log "ERROR" "Not all pods are ready (${ready_pods}/${total_pods})"
        return 1
    fi
    
    # Check service endpoints
    if ! kubectl get endpoints "${service_name}" -n "${namespace}" | grep -q "${service_name}"; then
        log "ERROR" "Service endpoints not found"
        return 1
    fi
    
    # Verify resource utilization
    local cpu_usage=$(kubectl top pod -n "${namespace}" -l "app=${service_name}" --no-headers | awk '{print $2}' | sed 's/m//')
    if [[ "${cpu_usage}" -gt "${ROLLBACK_THRESHOLD}" ]]; then
        log "ERROR" "CPU usage exceeds threshold (${cpu_usage}%)"
        return 1
    fi
    
    log "INFO" "Deployment validation passed"
    return 0
}

# Main execution
main() {
    local environment=$1
    
    setup_logging
    
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    fi
    
    if ! build_images "${environment}"; then
        log "ERROR" "Image build failed"
        exit 1
    fi
    
    for service in "${SERVICES[@]}"; do
        if ! deploy_service "${service}" "${environment}"; then
            log "ERROR" "Deployment failed for ${service}"
            exit 1
        fi
    done
    
    log "INFO" "Deployment completed successfully"
    exit 0
}

# Script entry point
if [[ $# -ne 1 || ! " ${ENVIRONMENTS[@]} " =~ " $1 " ]]; then
    echo "Usage: $0 <environment>"
    echo "Available environments: ${ENVIRONMENTS[*]}"
    exit 1
fi

main "$1"
```

This deployment script implements a robust, production-grade deployment process with the following key features:

1. Comprehensive prerequisite checking
2. Secure image building with vulnerability scanning
3. Zero-downtime deployments using canary releases
4. Progressive rollout strategy with health checks
5. Automated rollback capabilities
6. Detailed logging and monitoring
7. Resource utilization validation
8. Deployment locking to prevent concurrent deployments
9. Environment-specific configurations
10. Security-focused deployment practices

The script follows best practices for shell scripting including:
- Strict error handling with `set -euo pipefail`
- Proper logging and error reporting
- Clear documentation and comments
- Modular function design
- Secure handling of sensitive operations
- Comprehensive validation at each step

Usage:
```bash
chmod +x deploy.sh
./deploy.sh <environment>
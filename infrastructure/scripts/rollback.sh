#!/usr/bin/env bash

# Enrollment System Rollback Script
# Version: 1.0
# Purpose: Automated rollback of Kubernetes deployments with enhanced validation
# Dependencies: kubectl (latest), kustomize (latest), aws-cli (2.x)

set -euo pipefail

# Global Variables
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly SERVICES=("api-gateway" "application-service" "auth-service" "document-service" "notification-service" "reporting-service" "workflow-service" "web")
readonly REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
readonly NAMESPACE_PREFIX="enrollment-system"
readonly MAX_ROLLBACK_ATTEMPTS=3
readonly ROLLBACK_TIMEOUT=300

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites with enhanced security validation
check_prerequisites() {
    log_info "Validating prerequisites..."

    # Check required tools
    local required_tools=("kubectl" "kustomize" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            return 1
        fi
    done

    # Validate kubectl version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ -z "$kubectl_version" ]]; then
        log_error "Failed to get kubectl version"
        return 1
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Invalid AWS credentials"
        return 1
    }

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Validate RBAC permissions
    if ! kubectl auth can-i get deployments --all-namespaces &> /dev/null; then
        log_error "Insufficient RBAC permissions"
        return 1
    }

    return 0
}

# Get previous stable revision with enhanced validation
get_previous_revision() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"

    log_info "Getting previous stable revision for ${service_name} in ${environment}..."

    # Get deployment history with timeout
    local history
    if ! history=$(timeout 30s kubectl rollout history deployment "${service_name}" -n "${namespace}" 2>/dev/null); then
        log_error "Failed to get deployment history"
        return 1
    }

    # Parse and validate revisions
    local revisions
    revisions=$(echo "$history" | grep -E '^[0-9]+' | awk '{print $1}' | sort -nr)
    
    # Find last stable revision
    for revision in $revisions; do
        # Skip current revision
        if [[ "$revision" == "$(kubectl get deployment "${service_name}" -n "${namespace}" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')" ]]; then
            continue
        }

        # Validate revision stability
        if kubectl rollout history deployment "${service_name}" -n "${namespace}" --revision="$revision" | grep -q "SuccessfullyDeployed"; then
            echo "$revision"
            return 0
        fi
    done

    log_error "No stable revision found"
    return 1
}

# Rollback service with progressive strategy
rollback_service() {
    local service_name=$1
    local environment=$2
    local revision=$3
    local namespace="${NAMESPACE_PREFIX}-${environment}"
    local attempt=1

    log_info "Rolling back ${service_name} to revision ${revision} in ${environment}..."

    # Pre-rollback validation
    log_info "Performing pre-rollback validation..."
    if ! validate_rollback "$service_name" "$environment"; then
        log_error "Pre-rollback validation failed"
        return 1
    }

    # Execute rollback with retry logic
    while [ $attempt -le $MAX_ROLLBACK_ATTEMPTS ]; do
        log_info "Rollback attempt ${attempt}/${MAX_ROLLBACK_ATTEMPTS}"

        if kubectl rollout undo deployment "${service_name}" -n "${namespace}" --to-revision="$revision" &> /dev/null; then
            # Wait for rollback to complete
            if kubectl rollout status deployment "${service_name}" -n "${namespace}" --timeout="${ROLLBACK_TIMEOUT}s" &> /dev/null; then
                # Post-rollback validation
                if validate_rollback "$service_name" "$environment"; then
                    log_info "Rollback successful"
                    return 0
                fi
            fi
        fi

        log_warn "Rollback attempt ${attempt} failed, retrying..."
        ((attempt++))
        sleep 5
    done

    log_error "Rollback failed after ${MAX_ROLLBACK_ATTEMPTS} attempts"
    return 1
}

# Comprehensive rollback validation
validate_rollback() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"
    local timeout=60

    log_info "Validating rollback for ${service_name}..."

    # Check deployment status
    if ! kubectl rollout status deployment "${service_name}" -n "${namespace}" --timeout="${timeout}s" &> /dev/null; then
        log_error "Deployment status check failed"
        return 1
    }

    # Verify pod health
    local ready_pods
    ready_pods=$(kubectl get deployment "${service_name}" -n "${namespace}" -o jsonpath='{.status.readyReplicas}')
    if [[ -z "$ready_pods" ]] || [[ "$ready_pods" -eq 0 ]]; then
        log_error "No ready pods found"
        return 1
    }

    # Check service endpoints
    if ! kubectl get endpoints "${service_name}" -n "${namespace}" | grep -q "${service_name}"; then
        log_error "Service endpoints not found"
        return 1
    }

    # Validate pod logs for errors
    if kubectl logs -l "app=${service_name}" -n "${namespace}" --tail=50 | grep -qi "error\|exception\|fatal"; then
        log_error "Found errors in pod logs"
        return 1
    }

    return 0
}

# Cleanup resources securely
cleanup_resources() {
    local service_name=$1
    local environment=$2
    local namespace="${NAMESPACE_PREFIX}-${environment}"

    log_info "Cleaning up resources..."

    # Archive rollback logs
    local log_dir="/var/log/enrollment-system/rollbacks"
    mkdir -p "$log_dir"
    kubectl logs -l "app=${service_name}" -n "${namespace}" > "${log_dir}/${service_name}_${environment}_$(date +%Y%m%d_%H%M%S).log"

    # Clear sensitive data
    unset AWS_SECRET_ACCESS_KEY
    unset AWS_SESSION_TOKEN

    return 0
}

# Main execution
main() {
    if [[ $# -lt 2 ]]; then
        log_error "Usage: $0 <service_name> <environment> [revision]"
        exit 1
    }

    local service_name=$1
    local environment=$2
    local revision=${3:-""}

    # Validate input parameters
    if [[ ! " ${SERVICES[@]} " =~ " ${service_name} " ]]; then
        log_error "Invalid service name: ${service_name}"
        exit 1
    }

    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log_error "Invalid environment: ${environment}"
        exit 1
    }

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    }

    # Get previous revision if not specified
    if [[ -z "$revision" ]]; then
        revision=$(get_previous_revision "$service_name" "$environment")
        if [[ -z "$revision" ]]; then
            log_error "Failed to get previous revision"
            exit 1
        fi
    fi

    # Execute rollback
    if ! rollback_service "$service_name" "$environment" "$revision"; then
        log_error "Rollback failed"
        exit 1
    fi

    # Cleanup
    if ! cleanup_resources "$service_name" "$environment"; then
        log_warn "Cleanup failed but rollback was successful"
    fi

    log_info "Rollback completed successfully"
    exit 0
}

# Execute main function
main "$@"
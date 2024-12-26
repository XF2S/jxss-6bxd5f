#!/usr/bin/env bash

# Enrollment System Database Backup Script v1.0.0
# Dependencies:
# - postgresql-client v14+
# - aws-cli v2.0+
# - gnupg v2.0+

set -euo pipefail
IFS=$'\n\t'

# Global variables with defaults from environment
readonly DB_HOST="${DB_HOST:-localhost}"
readonly DB_PORT="${DB_PORT:-5432}"
readonly DB_NAME="${DB_NAME:-enrollment}"
readonly DB_USERNAME="${DB_USERNAME:-postgres}"
readonly DB_PASSWORD="${DB_PASSWORD:-postgres}"
readonly BACKUP_DIR="${BACKUP_DIR:-/var/backup/postgres}"
readonly S3_BUCKET="${S3_BUCKET:-enrollment-backups}"
readonly GPG_KEY="${GPG_KEY:-backup@enrollment.com}"
readonly RETENTION_DAYS="${RETENTION_DAYS:-30}"
readonly PARALLEL_JOBS="${PARALLEL_JOBS:-2}"
readonly COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
readonly MIN_FREE_SPACE="${MIN_FREE_SPACE:-5120}" # MB

# Logging configuration
readonly LOG_FILE="${BACKUP_DIR}/backup.log"
readonly ERROR_LOG="${BACKUP_DIR}/error.log"

# Function: Enhanced logging with timestamps
log() {
    local level=$1
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "${LOG_FILE}"
}

# Function: Error logging with notification
error() {
    log "ERROR" "$*" >&2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${ERROR_LOG}"
}

# Function: Check prerequisites with enhanced verification
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Verify required tools
    local required_tools=("pg_dump" "aws" "gpg" "gzip" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            error "Required tool not found: ${tool}"
            return 1
        fi
    done

    # Verify PostgreSQL version compatibility
    local pg_version
    pg_version=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
    if [[ ${pg_version} -lt 14 ]]; then
        error "PostgreSQL client version must be 14 or higher"
        return 1
    fi

    # Check available disk space
    local available_space
    available_space=$(df -m "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
    if [[ ${available_space} -lt ${MIN_FREE_SPACE} ]]; then
        error "Insufficient disk space. Required: ${MIN_FREE_SPACE}MB, Available: ${available_space}MB"
        return 1
    }

    # Verify AWS S3 access
    if ! aws s3 ls "s3://${S3_BUCKET}" >/dev/null 2>&1; then
        error "Cannot access S3 bucket: ${S3_BUCKET}"
        return 1
    }

    # Verify GPG key
    if ! gpg --list-keys "${GPG_KEY}" >/dev/null 2>&1; then
        error "GPG key not found: ${GPG_KEY}"
        return 1
    }

    # Test database connectivity
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1; then
        error "Cannot connect to database"
        return 1
    }

    log "INFO" "Prerequisites check passed"
    return 0
}

# Function: Create optimized database backup
create_backup() {
    local backup_type=$1
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${backup_type}_${timestamp}.sql"
    
    log "INFO" "Starting backup: ${backup_file}"
    
    # Set up parallel backup jobs
    local pg_dump_opts=(
        "--host=${DB_HOST}"
        "--port=${DB_PORT}"
        "--username=${DB_USERNAME}"
        "--format=directory"
        "--jobs=${PARALLEL_JOBS}"
        "--verbose"
        "--file=${backup_file}"
    )

    # Add specific options based on backup type
    case "${backup_type}" in
        "full")
            pg_dump_opts+=("--blobs" "--clean" "--if-exists")
            ;;
        "schema")
            pg_dump_opts+=("--schema-only")
            ;;
        *)
            error "Invalid backup type: ${backup_type}"
            return 1
            ;;
    esac

    # Execute backup with progress monitoring
    PGPASSWORD="${DB_PASSWORD}" pg_dump "${pg_dump_opts[@]}" "${DB_NAME}" 2>> "${ERROR_LOG}"
    
    if [[ $? -ne 0 ]]; then
        error "Backup failed"
        return 1
    fi

    # Verify backup integrity
    if ! PGPASSWORD="${DB_PASSWORD}" pg_restore --list "${backup_file}" >/dev/null 2>&1; then
        error "Backup verification failed"
        return 1
    }

    log "INFO" "Backup completed successfully: ${backup_file}"
    echo "${backup_file}"
}

# Function: Encrypt backup with compression
encrypt_backup() {
    local backup_file=$1
    local encrypted_file="${backup_file}.enc"
    
    log "INFO" "Encrypting backup: ${backup_file}"
    
    # Compress backup
    if ! tar czf - "${backup_file}" -C "${BACKUP_DIR}" | \
         gpg --encrypt --recipient "${GPG_KEY}" --trust-model always \
             --compress-algo ZLIB --compress-level "${COMPRESSION_LEVEL}" \
             --output "${encrypted_file}" 2>> "${ERROR_LOG}"; then
        error "Encryption failed"
        return 1
    }

    # Verify encryption
    if ! gpg --list-packets "${encrypted_file}" >/dev/null 2>&1; then
        error "Encryption verification failed"
        return 1
    }

    log "INFO" "Encryption completed: ${encrypted_file}"
    echo "${encrypted_file}"
}

# Function: Upload to S3 with lifecycle management
upload_to_s3() {
    local encrypted_file=$1
    local s3_path="s3://${S3_BUCKET}/$(basename "${encrypted_file}")"
    
    log "INFO" "Uploading to S3: ${s3_path}"
    
    # Calculate checksum
    local checksum
    checksum=$(openssl sha256 "${encrypted_file}" | awk '{print $2}')
    
    # Upload with metadata
    if ! aws s3 cp "${encrypted_file}" "${s3_path}" \
        --metadata "checksum=${checksum}" \
        --storage-class STANDARD_IA \
        --tags "retention=${RETENTION_DAYS}" 2>> "${ERROR_LOG}"; then
        error "S3 upload failed"
        return 1
    }

    # Verify upload
    if ! aws s3api head-object --bucket "${S3_BUCKET}" --key "$(basename "${encrypted_file}")" >/dev/null 2>&1; then
        error "S3 upload verification failed"
        return 1
    }

    log "INFO" "Upload completed: ${s3_path}"
    echo "${s3_path}"
}

# Function: Clean up old backups
cleanup_old_backups() {
    log "INFO" "Starting backup cleanup"
    
    # Local cleanup
    find "${BACKUP_DIR}" -type f -name "*.sql*" -mtime +"${RETENTION_DAYS}" -delete
    find "${BACKUP_DIR}" -type f -name "*.enc" -mtime +"${RETENTION_DAYS}" -delete
    
    # S3 cleanup (handled by lifecycle rules)
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "${S3_BUCKET}" \
        --lifecycle-configuration file://lifecycle.json 2>> "${ERROR_LOG}"
    
    log "INFO" "Cleanup completed"
}

# Main function with enhanced error handling
main() {
    local backup_type=${1:-"full"}
    local exit_code=0
    local backup_file=""
    local encrypted_file=""
    local s3_url=""
    
    # Initialize logging
    mkdir -p "${BACKUP_DIR}"
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${ERROR_LOG}")
    
    log "INFO" "Starting backup process: ${backup_type}"
    
    # Execute backup process with error handling
    if check_prerequisites; then
        if backup_file=$(create_backup "${backup_type}"); then
            if encrypted_file=$(encrypt_backup "${backup_file}"); then
                if s3_url=$(upload_to_s3 "${encrypted_file}"); then
                    cleanup_old_backups
                    log "INFO" "Backup process completed successfully"
                else
                    error "Failed to upload backup to S3"
                    exit_code=1
                fi
            else
                error "Failed to encrypt backup"
                exit_code=1
            fi
        else
            error "Failed to create backup"
            exit_code=1
        fi
    else
        error "Prerequisites check failed"
        exit_code=1
    fi
    
    # Cleanup temporary files
    [[ -n "${backup_file}" ]] && rm -rf "${backup_file}"
    [[ -n "${encrypted_file}" ]] && rm -f "${encrypted_file}"
    
    return "${exit_code}"
}

# Execute main function with command line arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
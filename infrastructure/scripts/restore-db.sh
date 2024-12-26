#!/usr/bin/env bash

# Enrollment System Database Restore Script
# Version: 1.0.0
# Dependencies:
# - postgresql-client: 14+
# - aws-cli: 2.0+
# - gnupg: 2.0+

set -euo pipefail
IFS=$'\n\t'

# Global variables with defaults from environment
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-enrollment}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
RESTORE_DIR="${RESTORE_DIR:-/var/restore/postgres}"
S3_BUCKET="${S3_BUCKET:-enrollment-backups}"
GPG_KEY="${GPG_KEY:-backup@enrollment.com}"
LOG_DIR="${LOG_DIR:-/var/log/enrollment}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@enrollment.com}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"

# Logging setup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/restore_${TIMESTAMP}.log"
ERROR_LOG="${LOG_DIR}/restore_error_${TIMESTAMP}.log"

# Create logging directory if it doesn't exist
mkdir -p "${LOG_DIR}"

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "${LOG_FILE}"
}

# Error handling function
error_handler() {
    local line_no=$1
    local error_code=$2
    log "ERROR" "Error occurred in script $0 at line $line_no (exit code: $error_code)"
    cleanup
    send_alert "Database restore failed at line $line_no with error code $error_code"
    exit 1
}

trap 'error_handler ${LINENO} $?' ERR

# Send alert email
send_alert() {
    local message=$1
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "Database Restore Alert - ${DB_NAME}" "${ALERT_EMAIL}"
    fi
    log "ALERT" "$message"
}

# Check prerequisites function
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check PostgreSQL client
    if ! command -v psql >/dev/null 2>&1; then
        log "ERROR" "PostgreSQL client not found"
        return 1
    fi
    
    # Check AWS CLI
    if ! command -v aws >/dev/null 2>&1; then
        log "ERROR" "AWS CLI not found"
        return 1
    fi
    
    # Check GPG
    if ! command -v gpg >/dev/null 2>&1; then
        log "ERROR" "GPG not found"
        return 1
    }
    
    # Check restore directory
    mkdir -p "${RESTORE_DIR}"
    if [ ! -w "${RESTORE_DIR}" ]; then
        log "ERROR" "Restore directory not writable: ${RESTORE_DIR}"
        return 1
    fi
    
    # Test database connection
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d "${DB_NAME}" -c '\q' >/dev/null 2>&1; then
        log "ERROR" "Cannot connect to database"
        return 1
    fi
    
    log "INFO" "Prerequisites check passed"
    return 0
}

# Download backup from S3
download_from_s3() {
    local backup_name=$1
    local local_path="${RESTORE_DIR}/${backup_name}"
    
    log "INFO" "Downloading backup from S3: ${backup_name}"
    
    # Check if backup exists in S3
    if ! aws s3 ls "s3://${S3_BUCKET}/${backup_name}" >/dev/null 2>&1; then
        log "ERROR" "Backup not found in S3: ${backup_name}"
        return 1
    fi
    
    # Download with progress
    if ! aws s3 cp "s3://${S3_BUCKET}/${backup_name}" "${local_path}" 2>>"${ERROR_LOG}"; then
        log "ERROR" "Failed to download backup from S3"
        return 1
    fi
    
    # Verify checksum
    local remote_md5
    remote_md5=$(aws s3api head-object --bucket "${S3_BUCKET}" --key "${backup_name}" --query 'ETag' --output text | tr -d '"')
    local local_md5
    local_md5=$(md5sum "${local_path}" | cut -d' ' -f1)
    
    if [ "${remote_md5}" != "${local_md5}" ]; then
        log "ERROR" "Checksum verification failed"
        return 1
    fi
    
    log "INFO" "Backup downloaded successfully"
    echo "${local_path}"
}

# Decrypt backup
decrypt_backup() {
    local encrypted_file=$1
    local decrypted_file="${encrypted_file%.gpg}"
    
    log "INFO" "Decrypting backup file..."
    
    # Decrypt using GPG
    if ! gpg --decrypt --quiet --trust-model always \
        --output "${decrypted_file}" "${encrypted_file}" 2>>"${ERROR_LOG}"; then
        log "ERROR" "Failed to decrypt backup"
        return 1
    fi
    
    # Verify decrypted file exists and is not empty
    if [ ! -s "${decrypted_file}" ]; then
        log "ERROR" "Decrypted file is empty or does not exist"
        return 1
    fi
    
    log "INFO" "Backup decrypted successfully"
    echo "${decrypted_file}"
}

# Validate backup
validate_backup() {
    local backup_file=$1
    
    log "INFO" "Validating backup file..."
    
    # Check file format
    if ! pg_restore -l "${backup_file}" >/dev/null 2>>"${ERROR_LOG}"; then
        log "ERROR" "Invalid backup format"
        return 1
    fi
    
    # Verify required schemas exist
    if ! pg_restore -l "${backup_file}" | grep -q "SCHEMA"; then
        log "ERROR" "No schemas found in backup"
        return 1
    }
    
    log "INFO" "Backup validation passed"
    return 0
}

# Restore database
restore_database() {
    local backup_file=$1
    local restore_type=$2
    
    log "INFO" "Starting database restore..."
    
    # Create restore point
    local restore_point="restore_${TIMESTAMP}"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" \
        -U "${DB_USERNAME}" -d "${DB_NAME}" \
        -c "SELECT pg_create_restore_point('${restore_point}')" \
        >>"${LOG_FILE}" 2>>"${ERROR_LOG}"
    
    # Perform restore based on type
    case "${restore_type}" in
        "full")
            log "INFO" "Performing full database restore..."
            PGPASSWORD="${DB_PASSWORD}" pg_restore -h "${DB_HOST}" -p "${DB_PORT}" \
                -U "${DB_USERNAME}" -d "${DB_NAME}" \
                --clean --if-exists --no-owner --no-privileges --verbose \
                "${backup_file}" >>"${LOG_FILE}" 2>>"${ERROR_LOG}"
            ;;
        "schema")
            log "INFO" "Performing schema-only restore..."
            PGPASSWORD="${DB_PASSWORD}" pg_restore -h "${DB_HOST}" -p "${DB_PORT}" \
                -U "${DB_USERNAME}" -d "${DB_NAME}" \
                --schema-only --clean --if-exists --no-owner --no-privileges --verbose \
                "${backup_file}" >>"${LOG_FILE}" 2>>"${ERROR_LOG}"
            ;;
        *)
            log "ERROR" "Invalid restore type: ${restore_type}"
            return 1
            ;;
    esac
    
    # Verify restore
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" \
        -U "${DB_USERNAME}" -d "${DB_NAME}" \
        -c "SELECT count(*) FROM pg_tables" >/dev/null 2>>"${ERROR_LOG}"; then
        log "ERROR" "Database restore verification failed"
        return 1
    fi
    
    log "INFO" "Database restore completed successfully"
    return 0
}

# Cleanup function
cleanup() {
    log "INFO" "Performing cleanup..."
    
    # Remove temporary files
    find "${RESTORE_DIR}" -type f -mtime +"${BACKUP_RETENTION}" -delete
    
    # Secure wipe of sensitive files
    find "${RESTORE_DIR}" -type f -name "*.sql" -exec shred -u {} \;
    find "${RESTORE_DIR}" -type f -name "*.gpg" -exec shred -u {} \;
    
    log "INFO" "Cleanup completed"
}

# Main function
main() {
    local backup_name=$1
    local restore_type=${2:-"full"}
    
    log "INFO" "Starting database restore process..."
    
    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    fi
    
    # Download backup
    local downloaded_file
    downloaded_file=$(download_from_s3 "${backup_name}")
    
    # Decrypt backup
    local decrypted_file
    decrypted_file=$(decrypt_backup "${downloaded_file}")
    
    # Validate backup
    if ! validate_backup "${decrypted_file}"; then
        log "ERROR" "Backup validation failed"
        cleanup
        exit 1
    fi
    
    # Perform restore
    if ! restore_database "${decrypted_file}" "${restore_type}"; then
        log "ERROR" "Database restore failed"
        cleanup
        exit 1
    fi
    
    # Cleanup
    cleanup
    
    log "INFO" "Database restore process completed successfully"
    return 0
}

# Script execution
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <backup_name> [restore_type]"
    echo "restore_type: full (default) or schema"
    exit 1
fi

main "$@"
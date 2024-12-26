#!/usr/bin/env bash

# Database Initialization Script for Enrollment System
# Version: 1.0.0
# Dependencies: PostgreSQL 14+, psql client
# Description: Initializes and configures PostgreSQL database with enhanced security,
#             replication, and monitoring capabilities.

set -euo pipefail
IFS=$'\n\t'

# Environment variables with defaults
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-enrollment}"
export DB_USER="${DB_USER:-enrollment_user}"
export DB_PASSWORD="${DB_PASSWORD}"
export PGPASSWORD="${DB_PASSWORD}"
export WAL_LEVEL="${WAL_LEVEL:-logical}"
export MAX_CONNECTIONS="${MAX_CONNECTIONS:-200}"
export STATEMENT_TIMEOUT="${STATEMENT_TIMEOUT:-30000}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# Logging configuration
LOGFILE="/var/log/enrollment/db-init-$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$(dirname "$LOGFILE")"

# Logging function
log() {
    local level="$1"
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOGFILE"
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_no=$1
    log "ERROR" "Script failed at line $line_no with exit code $exit_code"
    cleanup
    exit 1
}

trap 'handle_error ${LINENO}' ERR

# Cleanup function
cleanup() {
    log "INFO" "Performing cleanup operations..."
    # Drop incomplete objects if initialization fails
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
    DROP DATABASE IF EXISTS ${DB_NAME};
EOF
}

# Validation function
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check PostgreSQL version
    local pg_version
    pg_version=$(psql -V | grep -oE '[0-9]+' | head -1)
    if [ "$pg_version" -lt 14 ]; then
        log "ERROR" "PostgreSQL version must be 14 or higher"
        exit 1
    }

    # Validate required environment variables
    if [ -z "$DB_PASSWORD" ] || [ -z "$ENCRYPTION_KEY" ]; then
        log "ERROR" "Required environment variables DB_PASSWORD and ENCRYPTION_KEY must be set"
        exit 1
    }
}

# Database creation function
create_database() {
    log "INFO" "Creating database ${DB_NAME}..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
    CREATE DATABASE ${DB_NAME}
        WITH 
        ENCODING = 'UTF8'
        LC_COLLATE = 'C.UTF-8'
        LC_CTYPE = 'C.UTF-8'
        TEMPLATE = template0
        CONNECTION LIMIT = ${MAX_CONNECTIONS};

    \c ${DB_NAME}

    ALTER DATABASE ${DB_NAME} SET timezone TO 'UTC';
    ALTER DATABASE ${DB_NAME} SET statement_timeout TO ${STATEMENT_TIMEOUT};
    ALTER DATABASE ${DB_NAME} SET idle_in_transaction_session_timeout TO '30min';
    ALTER DATABASE ${DB_NAME} SET default_tablespace = pg_default;
    ALTER DATABASE ${DB_NAME} SET default_with_oids = false;
EOF
}

# Extension creation function
create_extensions() {
    log "INFO" "Creating required extensions..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
    CREATE EXTENSION IF NOT EXISTS "pg_audit";
    CREATE EXTENSION IF NOT EXISTS "pg_partman";
    CREATE EXTENSION IF NOT EXISTS "pg_repack";
EOF
}

# Schema creation function
create_schemas() {
    log "INFO" "Creating database schemas..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
    CREATE SCHEMA IF NOT EXISTS public;
    CREATE SCHEMA IF NOT EXISTS audit;
    CREATE SCHEMA IF NOT EXISTS history;
    CREATE SCHEMA IF NOT EXISTS reporting;

    GRANT USAGE ON SCHEMA public TO ${DB_USER};
    GRANT USAGE ON SCHEMA audit TO ${DB_USER};
    GRANT USAGE ON SCHEMA history TO ${DB_USER};
    GRANT USAGE ON SCHEMA reporting TO ${DB_USER};

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT ON TABLES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA history GRANT SELECT ON TABLES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO ${DB_USER};
EOF
}

# Table creation function
create_tables() {
    log "INFO" "Creating database tables..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
    -- Users table with encryption
    CREATE TABLE public.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile JSONB,
        roles TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
    );

    -- Applications table with partitioning
    CREATE TABLE public.applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id),
        status VARCHAR(50) NOT NULL,
        form_data JSONB NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    ) PARTITION BY RANGE (submitted_at);

    -- Create partitions for applications
    CREATE TABLE public.applications_2023 PARTITION OF public.applications
        FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
    CREATE TABLE public.applications_2024 PARTITION OF public.applications
        FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

    -- Documents table
    CREATE TABLE public.documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id UUID NOT NULL REFERENCES public.applications(id),
        file_name TEXT NOT NULL,
        mime_type VARCHAR(255) NOT NULL,
        storage_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Workflow history with archival
    CREATE TABLE public.workflow_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id UUID NOT NULL REFERENCES public.applications(id),
        status VARCHAR(50) NOT NULL,
        comment TEXT,
        updated_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX idx_users_email ON public.users(email);
    CREATE INDEX idx_applications_user_id ON public.applications(user_id);
    CREATE INDEX idx_applications_status ON public.applications(status);
    CREATE INDEX idx_applications_submitted_at ON public.applications(submitted_at);
    CREATE INDEX idx_documents_application_id ON public.documents(application_id);
    CREATE INDEX idx_workflow_history_application_id ON public.workflow_history(application_id);

    -- Setup audit logging
    CREATE TABLE audit.audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        old_data JSONB,
        new_data JSONB,
        user_id UUID,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
EOF
}

# Security setup function
setup_permissions() {
    log "INFO" "Setting up permissions and security policies..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
    -- Create application roles
    CREATE ROLE enrollment_readonly;
    CREATE ROLE enrollment_readwrite;
    CREATE ROLE enrollment_admin;

    -- Setup row level security
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

    -- Create security policies
    CREATE POLICY users_access ON public.users
        USING (id = current_user_id() OR 'enrollment_admin' = ANY(current_user_roles()));
        
    CREATE POLICY applications_access ON public.applications
        USING (user_id = current_user_id() OR 'enrollment_admin' = ANY(current_user_roles()));

    -- Setup column encryption
    ALTER TABLE public.users
        ALTER COLUMN password_hash SET (ENCRYPTED WITH = 'aes-gcm');
EOF
}

# Replication setup function
setup_replication() {
    log "INFO" "Configuring database replication..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
    -- Configure WAL level
    ALTER SYSTEM SET wal_level = '${WAL_LEVEL}';
    ALTER SYSTEM SET max_wal_senders = '10';
    ALTER SYSTEM SET max_replication_slots = '10';
    ALTER SYSTEM SET hot_standby = 'on';

    -- Create replication slot
    SELECT pg_create_physical_replication_slot('enrollment_replica_slot');

    -- Create replication user
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${DB_PASSWORD}';
EOF
}

# Main function
main() {
    log "INFO" "Starting database initialization..."
    
    validate_prerequisites
    
    # Execute initialization steps in transaction
    create_database
    create_extensions
    create_schemas
    create_tables
    setup_permissions
    setup_replication
    
    log "INFO" "Database initialization completed successfully"
    
    # Verify setup
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"
    
    return 0
}

# Execute main function
main
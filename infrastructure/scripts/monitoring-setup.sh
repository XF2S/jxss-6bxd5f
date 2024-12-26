#!/bin/bash

# Enrollment System Monitoring Setup Script
# Version: 1.0.0
# Purpose: Automated setup of monitoring infrastructure with enhanced security

# Strict error handling
set -euo pipefail
IFS=$'\n\t'

# Global variables from specification
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="9.5.0"
ELASTICSEARCH_VERSION="8.0.0"
MONITORING_DIR="/opt/monitoring"
PROMETHEUS_PORT="9090"
GRAFANA_PORT="3000"
ELASTICSEARCH_PORT="9200"
CERT_DIR="/opt/monitoring/certs"
BACKUP_DIR="/opt/monitoring/backups"
LOG_DIR="/opt/monitoring/logs"
RETENTION_DAYS="30"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    echo -e "${level}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$LOG_DIR/setup.log"
}

# Enhanced prerequisites check
check_prerequisites() {
    log "${YELLOW}" "Checking prerequisites..."
    
    # Check Docker version
    if ! docker --version >/dev/null 2>&1; then
        log "${RED}" "Docker not installed. Please install Docker first."
        return 1
    fi

    # Check Docker Compose
    if ! docker-compose --version >/dev/null 2>&1; then
        log "${RED}" "Docker Compose not installed. Please install Docker Compose first."
        return 1
    }

    # Check required ports
    for port in $PROMETHEUS_PORT $GRAFANA_PORT $ELASTICSEARCH_PORT; do
        if netstat -tuln | grep -q ":$port "; then
            log "${RED}" "Port $port is already in use"
            return 1
        fi
    done

    # Check disk space (minimum 20GB required)
    available_space=$(df -BG "${MONITORING_DIR}" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "${available_space}" -lt 20 ]; then
        log "${RED}" "Insufficient disk space. Minimum 20GB required."
        return 1
    fi

    # Create required directories with secure permissions
    for dir in "$MONITORING_DIR" "$CERT_DIR" "$BACKUP_DIR" "$LOG_DIR"; do
        mkdir -p "$dir"
        chmod 750 "$dir"
    done

    log "${GREEN}" "Prerequisites check completed successfully"
    return 0
}

# Enhanced certificate management
setup_certificates() {
    local domain_name=$1
    local cert_path=$2
    
    log "${YELLOW}" "Setting up SSL certificates..."

    # Create certificate directory if not exists
    mkdir -p "$cert_path"
    chmod 700 "$cert_path"

    # Generate CA certificate if not exists
    if [ ! -f "$cert_path/ca.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -days 365 -nodes \
            -keyout "$cert_path/ca-key.pem" \
            -out "$cert_path/ca.pem" \
            -subj "/CN=Monitoring CA"
        chmod 600 "$cert_path/ca-key.pem"
    fi

    # Generate certificates for each service
    for service in prometheus grafana elasticsearch; do
        if [ ! -f "$cert_path/$service.pem" ]; then
            openssl req -newkey rsa:2048 -nodes \
                -keyout "$cert_path/$service-key.pem" \
                -out "$cert_path/$service.csr" \
                -subj "/CN=$service.$domain_name"
            
            openssl x509 -req -days 365 \
                -in "$cert_path/$service.csr" \
                -CA "$cert_path/ca.pem" \
                -CAkey "$cert_path/ca-key.pem" \
                -CAcreateserial \
                -out "$cert_path/$service.pem"
            
            chmod 600 "$cert_path/$service-key.pem"
            rm "$cert_path/$service.csr"
        fi
    done

    log "${GREEN}" "SSL certificates setup completed"
    return 0
}

# Enhanced Prometheus setup
setup_prometheus() {
    local config_path=$1
    local cert_path=$2
    
    log "${YELLOW}" "Setting up Prometheus..."

    # Create Prometheus directories
    mkdir -p "$MONITORING_DIR/prometheus/data"
    chmod 750 "$MONITORING_DIR/prometheus/data"

    # Copy and validate configuration
    cp "$config_path" "$MONITORING_DIR/prometheus/prometheus.yml"
    docker run --rm -v "$MONITORING_DIR/prometheus:/etc/prometheus" \
        "prom/prometheus:v${PROMETHEUS_VERSION}" \
        --check-config --config.file=/etc/prometheus/prometheus.yml

    # Start Prometheus with security configurations
    docker run -d \
        --name prometheus \
        --restart unless-stopped \
        -p "${PROMETHEUS_PORT}:9090" \
        -v "$MONITORING_DIR/prometheus:/etc/prometheus" \
        -v "$cert_path:/certs" \
        --user "$(id -u):$(id -g)" \
        "prom/prometheus:v${PROMETHEUS_VERSION}" \
        --config.file=/etc/prometheus/prometheus.yml \
        --storage.tsdb.path=/etc/prometheus/data \
        --storage.tsdb.retention.time="${RETENTION_DAYS}d" \
        --web.enable-lifecycle \
        --web.enable-admin-api \
        --web.external-url=https://prometheus.local

    log "${GREEN}" "Prometheus setup completed"
    return 0
}

# Enhanced Grafana setup
setup_grafana() {
    local datasources_path=$1
    local dashboards_path=$2
    local cert_path=$3
    
    log "${YELLOW}" "Setting up Grafana..."

    # Create Grafana directories
    mkdir -p "$MONITORING_DIR/grafana/data"
    mkdir -p "$MONITORING_DIR/grafana/provisioning/datasources"
    mkdir -p "$MONITORING_DIR/grafana/provisioning/dashboards"
    chmod -R 750 "$MONITORING_DIR/grafana"

    # Copy configurations
    cp "$datasources_path" "$MONITORING_DIR/grafana/provisioning/datasources/"
    cp -r "$dashboards_path"/* "$MONITORING_DIR/grafana/provisioning/dashboards/"

    # Generate secure admin password
    GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
    echo "$GRAFANA_ADMIN_PASSWORD" > "$MONITORING_DIR/grafana/admin_password.txt"
    chmod 600 "$MONITORING_DIR/grafana/admin_password.txt"

    # Start Grafana with security configurations
    docker run -d \
        --name grafana \
        --restart unless-stopped \
        -p "${GRAFANA_PORT}:3000" \
        -v "$MONITORING_DIR/grafana:/var/lib/grafana" \
        -v "$cert_path:/certs" \
        -e "GF_SECURITY_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD" \
        -e "GF_SERVER_PROTOCOL=https" \
        -e "GF_SERVER_CERT_FILE=/certs/grafana.pem" \
        -e "GF_SERVER_CERT_KEY=/certs/grafana-key.pem" \
        "grafana/grafana:${GRAFANA_VERSION}"

    log "${GREEN}" "Grafana setup completed"
    return 0
}

# Enhanced Elasticsearch setup
setup_elasticsearch() {
    local config_path=$1
    local cert_path=$2
    
    log "${YELLOW}" "Setting up Elasticsearch..."

    # Create Elasticsearch directories
    mkdir -p "$MONITORING_DIR/elasticsearch/data"
    mkdir -p "$MONITORING_DIR/elasticsearch/config"
    chmod -R 750 "$MONITORING_DIR/elasticsearch"

    # Copy configuration
    cp "$config_path" "$MONITORING_DIR/elasticsearch/config/elasticsearch.yml"

    # Generate Elasticsearch keystore
    docker run --rm \
        -v "$cert_path:/certs" \
        -v "$MONITORING_DIR/elasticsearch:/usr/share/elasticsearch/data" \
        "docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}" \
        bin/elasticsearch-keystore create

    # Start Elasticsearch with security configurations
    docker run -d \
        --name elasticsearch \
        --restart unless-stopped \
        -p "${ELASTICSEARCH_PORT}:9200" \
        -v "$MONITORING_DIR/elasticsearch:/usr/share/elasticsearch/data" \
        -v "$cert_path:/certs" \
        -e "discovery.type=single-node" \
        -e "ELASTIC_PASSWORD=$(openssl rand -base64 32)" \
        -e "xpack.security.enabled=true" \
        -e "xpack.security.transport.ssl.enabled=true" \
        "docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}"

    log "${GREEN}" "Elasticsearch setup completed"
    return 0
}

# Enhanced monitoring verification
verify_monitoring() {
    log "${YELLOW}" "Verifying monitoring setup..."
    
    # Check service status
    for service in prometheus grafana elasticsearch; do
        if ! docker ps | grep -q "$service"; then
            log "${RED}" "$service is not running"
            return 1
        fi
    done

    # Verify Prometheus metrics collection
    if ! curl -sSf "http://localhost:${PROMETHEUS_PORT}/-/healthy" >/dev/null; then
        log "${RED}" "Prometheus health check failed"
        return 1
    fi

    # Verify Grafana accessibility
    if ! curl -sSf "http://localhost:${GRAFANA_PORT}/api/health" >/dev/null; then
        log "${RED}" "Grafana health check failed"
        return 1
    fi

    # Verify Elasticsearch cluster health
    if ! curl -sSf "http://localhost:${ELASTICSEARCH_PORT}/_cluster/health" >/dev/null; then
        log "${RED}" "Elasticsearch health check failed"
        return 1
    fi

    log "${GREEN}" "Monitoring verification completed successfully"
    return 0
}

# Main setup function
setup_monitoring() {
    local start_time=$(date +%s)
    
    log "${YELLOW}" "Starting monitoring setup..."

    # Create log file
    mkdir -p "$LOG_DIR"
    touch "$LOG_DIR/setup.log"

    # Run setup steps
    check_prerequisites || exit 1
    setup_certificates "monitoring.local" "$CERT_DIR" || exit 1
    setup_prometheus "../monitoring/prometheus/prometheus.yml" "$CERT_DIR" || exit 1
    setup_grafana "../monitoring/grafana/datasources.yml" "../monitoring/grafana/dashboards" "$CERT_DIR" || exit 1
    setup_elasticsearch "../monitoring/elk/elasticsearch.yml" "$CERT_DIR" || exit 1
    verify_monitoring || exit 1

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "${GREEN}" "Monitoring setup completed successfully in ${duration} seconds"
    return 0
}

# Execute main function
setup_monitoring
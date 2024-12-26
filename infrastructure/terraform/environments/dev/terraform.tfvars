# Development Environment Configuration
# Version: 1.0.0
# Purpose: Defines environment-specific variables for development infrastructure deployment

# Environment Identifier
environment = "dev"

# AWS Region Configuration
aws_region = "us-west-2"

# Project Identification
project_name = "enrollment-system"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b"
]

# Database Configuration
# Optimized for development workloads with cost-effective settings
db_config = {
  instance_class          = "db.t3.large"
  allocated_storage      = 100
  max_allocated_storage  = 500
  multi_az              = false
  backup_retention_period = 7
}

# Monitoring Configuration
# Enable enhanced monitoring for development environment observability
enable_monitoring = true

# Resource Tagging
# Comprehensive tagging strategy for resource management and cost allocation
tags = {
  Environment = "dev"
  Project     = "enrollment-system"
  ManagedBy   = "terraform"
  Owner       = "development-team"
}
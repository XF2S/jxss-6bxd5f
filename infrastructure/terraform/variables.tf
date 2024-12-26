# AWS Provider version: ~> 5.0

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9]$", var.aws_region))
    error_message = "Invalid AWS region format. Must be a valid AWS region (e.g., us-east-1, eu-west-1)"
  }
}

# VPC Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Availability Zones Configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for high availability deployment"
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability"
  }
}

# Database Configuration
variable "db_config" {
  type = object({
    instance_class    = string
    engine           = string
    engine_version   = string
    allocated_storage = number
    storage_type     = string
    multi_az         = bool
    username         = string
    password         = string
    port             = number
    parameter_family = string
    deletion_protection = bool
  })
  description = "Database configuration settings"
  sensitive   = true

  validation {
    condition     = var.db_config.allocated_storage >= 20
    error_message = "Allocated storage must be at least 20GB"
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring and alerting features"
  default     = true
}

# Backup Configuration
variable "backup_retention" {
  type        = number
  description = "Number of days to retain backups"
  default     = 7

  validation {
    condition     = var.backup_retention >= 7 && var.backup_retention <= 35
    error_message = "Backup retention period must be between 7 and 35 days"
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags for all resources"
  default     = {}
}

# Auto Scaling Configuration
variable "autoscaling_config" {
  type = object({
    min_capacity     = number
    max_capacity     = number
    target_cpu       = number
    target_memory    = number
    scale_in_cooldown  = number
    scale_out_cooldown = number
  })
  description = "Auto scaling configuration for ECS services"

  validation {
    condition     = var.autoscaling_config.min_capacity > 0 && var.autoscaling_config.max_capacity >= var.autoscaling_config.min_capacity
    error_message = "Min capacity must be > 0 and max capacity must be >= min capacity"
  }
}

# Security Configuration
variable "security_config" {
  type = object({
    enable_encryption    = bool
    ssl_certificate_arn = string
    allowed_cidr_blocks = list(string)
    enable_waf          = bool
    enable_shield       = bool
  })
  description = "Security and compliance configuration"

  validation {
    condition     = var.security_config.enable_encryption == true
    error_message = "Encryption must be enabled for compliance requirements"
  }
}

# Cache Configuration
variable "elasticache_config" {
  type = object({
    node_type       = string
    num_cache_nodes = number
    engine_version  = string
    port           = number
  })
  description = "ElastiCache configuration for Redis"

  validation {
    condition     = var.elasticache_config.num_cache_nodes >= 2
    error_message = "At least 2 cache nodes required for high availability"
  }
}

# DNS Configuration
variable "dns_config" {
  type = object({
    domain_name = string
    create_alias = bool
    zone_id     = string
  })
  description = "Route 53 DNS configuration"
}

# Monitoring and Logging
variable "monitoring_config" {
  type = object({
    retention_days    = number
    enable_dashboard = bool
    alarm_email      = string
  })
  description = "CloudWatch monitoring and logging configuration"

  validation {
    condition     = var.monitoring_config.retention_days >= 30
    error_message = "Log retention must be at least 30 days"
  }
}
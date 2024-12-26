# AWS Provider version: ~> 5.0

# Environment Identifier
variable "environment" {
  type        = string
  description = "Development environment identifier for resource naming and tagging"
  default     = "dev"

  validation {
    condition     = can(regex("^dev$", var.environment))
    error_message = "Environment must be 'dev' for development environment."
  }
}

# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for development resources with high availability support"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[1-9][0-9]?$", var.aws_region))
    error_message = "AWS region must be in valid format (e.g., us-west-2)."
  }
}

# VPC Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for development VPC with appropriate network segmentation"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be in valid CIDR notation."
  }
}

# Availability Zones Configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for development environment redundancy"
  default     = ["us-west-2a", "us-west-2b"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability."
  }
}

# Database Configuration
variable "db_config" {
  type = object({
    instance_class               = string
    allocated_storage           = number
    max_allocated_storage      = number
    multi_az                   = bool
    backup_retention_period    = number
    deletion_protection        = bool
    storage_encrypted         = bool
    monitoring_interval       = number
    performance_insights_enabled = bool
    auto_minor_version_upgrade = bool
  })
  description = "Comprehensive development database configuration with security and performance settings"
  default = {
    instance_class               = "db.t3.large"
    allocated_storage           = 100
    max_allocated_storage      = 500
    multi_az                   = false
    backup_retention_period    = 7
    deletion_protection        = true
    storage_encrypted         = true
    monitoring_interval       = 60
    performance_insights_enabled = true
    auto_minor_version_upgrade = true
  }

  validation {
    condition     = var.db_config.allocated_storage >= 100 && var.db_config.allocated_storage <= var.db_config.max_allocated_storage
    error_message = "Allocated storage must be at least 100GB and less than max_allocated_storage."
  }

  validation {
    condition     = var.db_config.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days for development environment."
  }

  validation {
    condition     = var.db_config.storage_encrypted == true
    error_message = "Storage encryption must be enabled for security compliance."
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring and logging for development environment"
  default     = true

  validation {
    condition     = var.enable_monitoring == true
    error_message = "Monitoring must be enabled in development environment for security and troubleshooting."
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags for development environment resources including security and compliance"
  default = {
    Environment        = "dev"
    Project           = "enrollment-system"
    ManagedBy         = "terraform"
    SecurityZone      = "development"
    DataClassification = "restricted"
    Compliance        = "education-data"
    CostCenter        = "dev-ops"
    AutoShutdown      = "enabled"
  }

  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "SecurityZone")
    error_message = "Tags must include mandatory Environment and SecurityZone tags."
  }

  validation {
    condition     = var.tags["Environment"] == "dev"
    error_message = "Environment tag must be set to 'dev' for development environment."
  }
}
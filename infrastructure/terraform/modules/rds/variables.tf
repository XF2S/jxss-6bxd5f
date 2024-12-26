# AWS Provider version ~> 5.0

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for database subnet group and security group"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for RDS placement"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.large"
}

variable "allocated_storage" {
  type        = number
  description = "Initial storage allocation in GB"
  default     = 100

  validation {
    condition     = var.allocated_storage >= 20 && var.allocated_storage <= 65536
    error_message = "Allocated storage must be between 20 GB and 65,536 GB"
  }
}

variable "max_allocated_storage" {
  type        = number
  description = "Maximum storage allocation for autoscaling in GB"
  default     = 500

  validation {
    condition     = var.max_allocated_storage >= 100 && var.max_allocated_storage <= 65536
    error_message = "Maximum allocated storage must be between 100 GB and 65,536 GB"
  }
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7

  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days"
  }
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for high availability"
  default     = true
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for RDS encryption"
  default     = null

  validation {
    condition     = var.kms_key_arn == null || can(regex("^arn:aws:kms:", var.kms_key_arn))
    error_message = "KMS key ARN must be a valid AWS KMS key ARN"
  }
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights for monitoring"
  default     = true
}

variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection for RDS instance"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for the RDS instance and related resources"
  default     = {}
}

# PostgreSQL specific variables
variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version"
  default     = "14.7"

  validation {
    condition     = can(regex("^14\\.", var.engine_version))
    error_message = "Engine version must be PostgreSQL 14.x"
  }
}

variable "parameter_family" {
  type        = string
  description = "Database parameter group family"
  default     = "postgres14"
}

variable "db_name" {
  type        = string
  description = "Name of the initial database"
  default     = "enrollment"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "port" {
  type        = number
  description = "Database port number"
  default     = 5432

  validation {
    condition     = var.port > 0 && var.port < 65536
    error_message = "Port must be between 1 and 65535"
  }
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced Monitoring interval in seconds"
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60"
  }
}

variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window"
  default     = "sun:03:00-sun:04:00"

  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-ddd:hh:mm'"
  }
}

variable "backup_window" {
  type        = string
  description = "Preferred backup window"
  default     = "02:00-03:00"

  validation {
    condition     = can(regex("^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$", var.backup_window))
    error_message = "Backup window must be in the format 'hh:mm-hh:mm'"
  }
}
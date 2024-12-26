# Production Environment Variables
# AWS Provider Version: ~> 5.0

variable "environment" {
  type        = string
  description = "Production environment identifier with strict validation"
  default     = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "Environment must be 'prod' for production configuration"
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for production deployment with US region restriction"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^us-(east|west)-[1-2]$", var.aws_region))
    error_message = "Production must be deployed in a US region (us-east-1/2 or us-west-1/2)"
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for production VPC with validation"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones with minimum 3 AZ requirement"
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]

  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "Production requires at least 3 availability zones for high availability"
  }
}

variable "db_config" {
  type = object({
    instance_class              = string
    allocated_storage          = number
    max_allocated_storage      = number
    backup_retention_period    = number
    multi_az                   = bool
    deletion_protection        = bool
    performance_insights_enabled = bool
    monitoring_interval        = number
  })
  description = "Enhanced production database configuration with performance insights and monitoring"
  
  default = {
    instance_class              = "db.r6g.xlarge"
    allocated_storage          = 100
    max_allocated_storage      = 1000
    backup_retention_period    = 30
    multi_az                   = true
    deletion_protection        = true
    performance_insights_enabled = true
    monitoring_interval        = 60
  }

  validation {
    condition     = var.db_config.instance_class != "" && can(regex("^db\\.", var.db_config.instance_class))
    error_message = "Database instance class must be a valid RDS instance type"
  }

  validation {
    condition     = var.db_config.allocated_storage >= 100 && var.db_config.allocated_storage <= var.db_config.max_allocated_storage
    error_message = "Allocated storage must be at least 100GB and less than max_allocated_storage"
  }

  validation {
    condition     = var.db_config.backup_retention_period >= 30
    error_message = "Production backup retention period must be at least 30 days"
  }

  validation {
    condition     = var.db_config.multi_az == true
    error_message = "Multi-AZ deployment is required for production environment"
  }
}

variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring and alerting for production environment"
  default     = true

  validation {
    condition     = var.enable_monitoring == true
    error_message = "Enhanced monitoring must be enabled in production environment"
  }
}
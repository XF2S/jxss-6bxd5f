# AWS Provider version ~> 4.0

# Project and Environment Variables
variable "project" {
  type        = string
  description = "Project name for resource naming and tagging"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.project))
    error_message = "Project name must start with a letter and can contain letters, numbers, and hyphens."
  }
}

variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod", "uat"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, uat."
  }
}

# Networking Variables
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the Redis cluster will be deployed"
  validation {
    condition     = can(regex("^vpc-[a-f0-9]{8,}$", var.vpc_id))
    error_message = "VPC ID must be a valid vpc-* identifier."
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for multi-AZ Redis cluster deployment"
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability."
  }
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access the Redis cluster"
  validation {
    condition = alltrue([
      for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))
    ])
    error_message = "All elements must be valid CIDR blocks."
  }
}

# Instance Configuration Variables
variable "node_type" {
  type        = string
  description = "The compute and memory capacity of the nodes"
  default     = "cache.t3.medium"
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.node_type))
    error_message = "Node type must be a valid Redis node type (e.g., cache.t3.medium)."
  }
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the cluster"
  default     = 2
  validation {
    condition     = var.num_cache_nodes >= 1 && var.num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "port" {
  type        = number
  description = "Port number for Redis cluster"
  default     = 6379
  validation {
    condition     = var.port > 1024 && var.port < 65535
    error_message = "Port must be between 1024 and 65535."
  }
}

variable "parameter_group_family" {
  type        = string
  description = "Redis parameter group family version"
  default     = "redis7"
  validation {
    condition     = can(regex("^redis[0-9]+\\.[0-9x]$", var.parameter_group_family))
    error_message = "Parameter group family must be a valid Redis version (e.g., redis7.x)."
  }
}

# Security Configuration Variables
variable "at_rest_encryption_enabled" {
  type        = bool
  description = "Enable encryption at rest using AES-256"
  default     = true
  validation {
    condition     = var.at_rest_encryption_enabled == true
    error_message = "Encryption at rest must be enabled for security compliance."
  }
}

variable "transit_encryption_enabled" {
  type        = bool
  description = "Enable TLS encryption in transit"
  default     = true
  validation {
    condition     = var.transit_encryption_enabled == true
    error_message = "Encryption in transit must be enabled for security compliance."
  }
}

# High Availability Configuration
variable "automatic_failover_enabled" {
  type        = bool
  description = "Enable automatic failover for Redis cluster (required for Multi-AZ)"
  default     = true
  validation {
    condition     = var.automatic_failover_enabled == true
    error_message = "Automatic failover must be enabled for high availability."
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Map of tags to apply to all resources"
  default     = {}
  validation {
    condition = alltrue([
      for key, value in var.tags : can(regex("^[\\w\\s-]+$", key)) && can(regex("^[\\w\\s-]+$", value))
    ])
    error_message = "Tags must contain only letters, numbers, spaces, and hyphens."
  }
}

# Maintenance Window
variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window (UTC)"
  default     = "sun:05:00-sun:09:00"
  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-ddd:hh:mm' (e.g., sun:05:00-sun:09:00)."
  }
}

# Backup Configuration
variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days for which ElastiCache will retain automatic snapshots"
  default     = 7
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  type        = string
  description = "Daily time range during which automated backups are created"
  default     = "03:00-05:00"
  validation {
    condition     = can(regex("^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$", var.snapshot_window))
    error_message = "Snapshot window must be in the format 'hh:mm-hh:mm' (e.g., 03:00-05:00)."
  }
}
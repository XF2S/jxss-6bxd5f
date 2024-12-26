# Environment variable with validation for allowed values
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Project name for resource naming consistency
variable "project_name" {
  type        = string
  description = "Project name used for resource naming and tagging"
}

# Document storage versioning configuration
variable "document_storage_versioning" {
  type        = bool
  description = "Enable versioning for document storage bucket to protect against accidental deletions and modifications"
  default     = true
}

# Lifecycle transition configuration for cost optimization
variable "document_lifecycle_transition_days" {
  type        = number
  description = "Number of days before transitioning objects to STANDARD_IA storage class"
  default     = 90
  
  validation {
    condition     = var.document_lifecycle_transition_days >= 30
    error_message = "Transition days must be at least 30 days for STANDARD_IA storage class."
  }
}

# Server-side encryption configuration
variable "enable_server_side_encryption" {
  type        = bool
  description = "Enable AES-256 server-side encryption for all S3 buckets"
  default     = true
}

# Backup storage bucket configuration
variable "enable_backup_storage" {
  type        = bool
  description = "Enable creation of backup storage bucket with versioning enabled"
  default     = true
}

# Static assets bucket configuration
variable "enable_static_assets" {
  type        = bool
  description = "Enable creation of static assets bucket with CloudFront integration support"
  default     = true
}

# Access logging configuration
variable "enable_access_logging" {
  type        = bool
  description = "Enable S3 access logging for audit and compliance purposes"
  default     = true
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Map of tags to apply to all resources for cost allocation and management"
  default = {
    "Terraform"   = "true"
    "Service"     = "enrollment-system"
    "Environment" = "dev"
  }
}

# Block public access configuration
variable "block_public_access" {
  type        = bool
  description = "Enable S3 block public access settings for all buckets"
  default     = true
}

# CORS configuration for static assets bucket
variable "static_assets_cors_allowed_origins" {
  type        = list(string)
  description = "List of allowed origins for CORS configuration on static assets bucket"
  default     = ["*"]
}

# Lifecycle expiration configuration
variable "document_lifecycle_expiration_days" {
  type        = number
  description = "Number of days before expiring objects in document storage bucket"
  default     = 2555  # 7 years retention

  validation {
    condition     = var.document_lifecycle_expiration_days >= 365
    error_message = "Document retention period must be at least 365 days."
  }
}

# Replication configuration
variable "enable_cross_region_replication" {
  type        = bool
  description = "Enable cross-region replication for disaster recovery"
  default     = false
}

# KMS encryption configuration
variable "kms_key_arn" {
  type        = string
  description = "ARN of KMS key for server-side encryption (optional, uses AES-256 if not provided)"
  default     = ""
}

# Intelligent tiering configuration
variable "enable_intelligent_tiering" {
  type        = bool
  description = "Enable S3 Intelligent-Tiering storage class for automatic cost optimization"
  default     = false
}
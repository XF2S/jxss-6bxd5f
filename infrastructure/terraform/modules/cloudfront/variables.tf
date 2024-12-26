# Provider version: ~> 5.0

# Project name variable for resource identification
variable "project_name" {
  description = "Name of the enrollment system project for resource tagging and identification"
  type        = string
  default     = "enrollment-system"

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 63 && can(regex("^[a-zA-Z0-9-]+$", var.project_name))
    error_message = "Project name must be 1-63 characters, containing only alphanumeric characters and hyphens"
  }
}

# Environment variable for deployment context
variable "environment" {
  description = "Deployment environment (dev, staging, prod) for environment-specific configurations"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# S3 origin identifier
variable "s3_origin_id" {
  description = "Unique identifier for the S3 bucket origin serving static content"
  type        = string
  default     = "enrollment-static-origin"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.s3_origin_id))
    error_message = "Origin ID must contain only alphanumeric characters and hyphens"
  }
}

# CloudFront price class selection
variable "price_class" {
  description = "CloudFront distribution price class determining edge location coverage and performance vs cost balance"
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "Price class must be one of: PriceClass_100, PriceClass_200, PriceClass_All"
  }
}

# Cache TTL configurations
variable "min_ttl" {
  description = "Minimum time to live for cached objects in seconds (0 for no minimum)"
  type        = number
  default     = 0

  validation {
    condition     = var.min_ttl >= 0 && var.min_ttl <= 31536000
    error_message = "Minimum TTL must be between 0 and 31536000 seconds (1 year)"
  }
}

variable "default_ttl" {
  description = "Default time to live for cached objects in seconds (3600 for optimal performance)"
  type        = number
  default     = 3600

  validation {
    condition     = var.default_ttl >= var.min_ttl && var.default_ttl <= var.max_ttl
    error_message = "Default TTL must be between min_ttl and max_ttl"
  }
}

variable "max_ttl" {
  description = "Maximum time to live for cached objects in seconds (86400 for daily refresh)"
  type        = number
  default     = 86400

  validation {
    condition     = var.max_ttl >= var.default_ttl && var.max_ttl <= 31536000
    error_message = "Maximum TTL must be between default_ttl and 31536000 seconds (1 year)"
  }
}

# HTTP method configurations
variable "allowed_methods" {
  description = "List of allowed HTTP methods for security control"
  type        = list(string)
  default     = ["GET", "HEAD", "OPTIONS"]

  validation {
    condition     = alltrue([for method in var.allowed_methods : contains(["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"], method)])
    error_message = "Allowed methods must be valid HTTP methods"
  }
}

variable "cached_methods" {
  description = "List of HTTP methods to cache for performance optimization"
  type        = list(string)
  default     = ["GET", "HEAD"]

  validation {
    condition     = alltrue([for method in var.cached_methods : contains(["GET", "HEAD", "OPTIONS"], method)])
    error_message = "Cached methods must be GET, HEAD, or OPTIONS"
  }
}

# Performance optimizations
variable "enable_compression" {
  description = "Enable compression for supported content types to improve delivery performance"
  type        = bool
  default     = true
}

# Security configurations
variable "viewer_protocol_policy" {
  description = "Protocol policy for viewer connections enforcing HTTPS for security"
  type        = string
  default     = "redirect-to-https"

  validation {
    condition     = contains(["allow-all", "https-only", "redirect-to-https"], var.viewer_protocol_policy)
    error_message = "Viewer protocol policy must be one of: allow-all, https-only, redirect-to-https"
  }
}
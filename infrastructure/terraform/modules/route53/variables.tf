# Primary domain name variable with RFC 1035 validation
variable "domain_name" {
  type        = string
  description = "Primary domain name for the enrollment system"
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name following RFC 1035 standards."
  }
}

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod) for resource isolation"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Health check domain variable with RFC 1035 validation
variable "health_check_domain" {
  type        = string
  description = "Domain name for Route53 health checks to monitor endpoint availability"
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.health_check_domain))
    error_message = "Health check domain must be a valid DNS name following RFC 1035 standards."
  }
}

# AWS region variable with validation
variable "aws_region" {
  type        = string
  description = "AWS region for Route53 resources deployment"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier (e.g., us-east-1)."
  }
}

# Resource tags variable
variable "tags" {
  type        = map(string)
  description = "Resource tags for Route53 resources following organizational standards"
  default     = {}
}

# Health check path variable
variable "health_check_path" {
  type        = string
  description = "Health check endpoint path for availability monitoring"
  default     = "/health"
}

# Health check port variable
variable "health_check_port" {
  type        = number
  description = "Port number for health checks (default: 443 for HTTPS)"
  default     = 443
}

# Health check type variable with validation
variable "health_check_type" {
  type        = string
  description = "Protocol for health checks (HTTP/HTTPS)"
  default     = "HTTPS"
  
  validation {
    condition     = contains(["HTTP", "HTTPS"], var.health_check_type)
    error_message = "Health check type must be either HTTP or HTTPS."
  }
}

# Health check failure threshold variable with validation
variable "health_check_failure_threshold" {
  type        = number
  description = "Number of consecutive failed checks before marking unhealthy (default: 3)"
  default     = 3
  
  validation {
    condition     = var.health_check_failure_threshold >= 1 && var.health_check_failure_threshold <= 10
    error_message = "Health check failure threshold must be between 1 and 10."
  }
}

# Health check request interval variable with validation
variable "health_check_request_interval" {
  type        = number
  description = "Interval between health checks in seconds (default: 30)"
  default     = 30
  
  validation {
    condition     = contains([10, 30], var.health_check_request_interval)
    error_message = "Health check interval must be either 10 or 30 seconds."
  }
}

# DNS TTL variable with validation
variable "dns_ttl" {
  type        = number
  description = "TTL (Time To Live) in seconds for DNS records"
  default     = 300
  
  validation {
    condition     = var.dns_ttl >= 60 && var.dns_ttl <= 86400
    error_message = "DNS TTL must be between 60 and 86400 seconds."
  }
}

# Latency-based routing variable
variable "enable_latency_routing" {
  type        = bool
  description = "Enable latency-based routing for multi-region deployments"
  default     = false
}

# Failover primary region variable with validation
variable "failover_primary_region" {
  type        = string
  description = "Primary AWS region for DNS failover configuration"
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.failover_primary_region))
    error_message = "Failover primary region must be a valid AWS region identifier."
  }
}
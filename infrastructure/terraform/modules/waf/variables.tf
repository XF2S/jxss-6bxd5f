# Environment configuration
variable "environment" {
  type        = string
  description = "Environment name for WAF deployment (dev/staging/prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# AWS Region configuration
variable "aws_region" {
  type        = string
  description = "AWS region for WAF resource deployment (e.g., us-east-1, eu-west-1)"
}

# ALB Integration
variable "alb_arn" {
  type        = string
  description = "ARN of the Application Load Balancer to associate with WAF"
  
  validation {
    condition     = can(regex("^arn:aws:elasticloadbalancing:[a-z0-9-]+:[0-9]{12}:loadbalancer/app/", var.alb_arn))
    error_message = "Invalid ALB ARN format. Must be a valid application load balancer ARN."
  }
}

# Rate Limiting Configuration
variable "rate_limit" {
  type        = number
  description = "Number of requests allowed per IP address per 5-minute period"
  
  validation {
    condition     = var.rate_limit >= 100 && var.rate_limit <= 20000
    error_message = "Rate limit must be between 100 and 20000 requests per 5 minutes."
  }
}

# IP Blocking Configuration
variable "block_period" {
  type        = number
  description = "Duration in minutes to block IPs that exceed rate limit"
  
  validation {
    condition     = var.block_period >= 5 && var.block_period <= 240
    error_message = "Block period must be between 5 and 240 minutes."
  }
}

# Logging Configuration
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain WAF logs in CloudWatch"
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be one of the allowed CloudWatch Logs retention periods."
  }
}

# IP Rate-Based Rule Configuration
variable "ip_rate_based_rule_limit" {
  type        = number
  description = "Maximum number of requests allowed from an IP in 5 minutes for DDoS protection"
  
  validation {
    condition     = var.ip_rate_based_rule_limit >= 2000 && var.ip_rate_based_rule_limit <= 100000
    error_message = "IP rate-based rule limit must be between 2000 and 100000 requests per 5 minutes."
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for WAF components"
  
  default = {
    "Terraform"   = "true"
    "Service"     = "waf"
    "SecurityZone" = "public"
  }
  
  validation {
    condition     = contains(keys(var.tags), "SecurityZone")
    error_message = "Tags must include SecurityZone key for compliance."
  }
}
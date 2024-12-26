# Required providers configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Primary Route53 hosted zone
resource "aws_route53_zone" "main" {
  name              = var.domain_name
  comment          = "Managed by Terraform - Enrollment System ${var.environment}"
  force_destroy    = false
  
  # Enable DNSSEC for enhanced security
  enable_dnssec    = true
  
  # Configure query logging for audit and monitoring
  dynamic "query_logging_config" {
    for_each = var.log_group_arn != "" ? [1] : []
    content {
      cloudwatch_log_group_arn = var.log_group_arn
      log_format              = "json"
    }
  }

  tags = merge(
    {
      Name        = "${var.domain_name}-zone"
      Environment = var.environment
      ManagedBy   = "terraform"
      Service     = "enrollment-system"
    },
    var.tags
  )
}

# Primary health check for DNS failover
resource "aws_route53_health_check" "main" {
  fqdn              = var.health_check_domain
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  # Enable latency measurement for performance monitoring
  measure_latency   = true
  
  # Multi-region health checking for better reliability
  regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1"
  ]
  
  # Check for specific healthy response content
  search_string     = "\"status\":\"healthy\""
  inverted         = false
  
  # Enable SNI for SSL verification
  enable_sni       = true

  tags = merge(
    {
      Name        = "${var.domain_name}-health-check"
      Environment = var.environment
      Purpose     = "DNS Failover"
      Critical    = "true"
      ManagedBy   = "terraform"
    },
    var.tags
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Primary A record for CloudFront distribution with failover routing
resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = "Z2FDTNDATAQYW2" # CloudFront's fixed zone ID
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.main.id
  set_identifier  = "primary"

  lifecycle {
    create_before_destroy = true
  }
}

# CNAME record for www subdomain
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.domain_name]
}

# TXT record for domain verification and SPF
resource "aws_route53_record" "txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = "300"
  records = [
    "v=spf1 include:_spf.enrollment-system.com -all",
    "enrollment-system-verification=${var.domain_verification_token}"
  ]
}

# MX records for email routing
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = "300"
  records = [
    "10 mail1.enrollment-system.com",
    "20 mail2.enrollment-system.com"
  ]
}

# CAA records for SSL/TLS certificate issuance control
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "CAA"
  ttl     = "300"
  records = [
    "0 issue \"amazon.com\"",
    "0 issue \"amazontrust.com\"",
    "0 issuewild \"amazontrust.com\""
  ]
}

# Variables block
variable "domain_name" {
  type        = string
  description = "Primary domain name for the enrollment system"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name following RFC 1035 standards."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod) for resource tagging and configuration"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "health_check_domain" {
  type        = string
  description = "Domain name for Route53 health checks with SSL verification"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.health_check_domain))
    error_message = "Health check domain must be a valid DNS name following RFC 1035 standards."
  }
}

variable "log_group_arn" {
  type        = string
  description = "CloudWatch Log Group ARN for DNS query logging"
  validation {
    condition     = can(regex("^arn:aws:logs:[a-z0-9-]+:[0-9]{12}:log-group:.+$", var.log_group_arn))
    error_message = "Log group ARN must be a valid CloudWatch Logs ARN."
  }
}

variable "domain_verification_token" {
  type        = string
  description = "Domain verification token for TXT record"
  default     = ""
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for Route53 resources"
  default     = {}
}

# Outputs block
output "zone_id" {
  description = "The ID of the hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "name_servers" {
  description = "The name servers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "health_check_id" {
  description = "The ID of the Route53 health check"
  value       = aws_route53_health_check.main.id
}

output "health_check_status" {
  description = "The status of the Route53 health check"
  value       = aws_route53_health_check.main.status
}
# AWS WAF Module Configuration
# Provider version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "waf-${var.environment}"
  common_tags = merge(var.tags, {
    Environment = var.environment
    Managed_By  = "terraform"
  })
}

# WAF Web ACL for comprehensive web application protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${local.name_prefix}-web-acl"
  description = "WAF Web ACL for ${var.environment} environment"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Core Rule Set (CRS)
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection Protection Rule
  rule {
    name     = "AWS-AWSManagedRulesSQLiRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # Cross-Site Scripting (XSS) Protection Rule
  rule {
    name     = "AWS-AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # IP Rate-Based Rule for DDoS Protection
  rule {
    name     = "IPRateBasedRule"
    priority = 4

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.ip_rate_based_rule_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "IPRateBasedRuleMetric"
      sampled_requests_enabled  = true
    }
  }

  # Custom Rate Limiting Rule
  rule {
    name     = "CustomRateLimitRule"
    priority = 5

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "CustomRateLimitRuleMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${local.name_prefix}-web-acl-metric"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# IP Set for manual IP blocking and allowlisting
resource "aws_wafv2_ip_set" "blocked_ips" {
  name               = "${local.name_prefix}-blocked-ips"
  description        = "IP set for blocked addresses"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = []

  tags = local.common_tags
}

# WAF Web ACL Association with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# CloudWatch Log Group for WAF Logging
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/waf/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  
  tags = local.common_tags
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  logging_filter {
    default_behavior = "KEEP"

    filter {
      behavior = "KEEP"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      requirement = "MEETS_ANY"
    }
  }
}

# Shield Advanced for enhanced DDoS protection (if environment is production)
resource "aws_shield_protection" "alb" {
  count        = var.environment == "prod" ? 1 : 0
  name         = "${local.name_prefix}-alb-protection"
  resource_arn = var.alb_arn

  tags = local.common_tags
}
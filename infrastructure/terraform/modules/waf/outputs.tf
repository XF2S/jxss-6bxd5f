# WAF Web ACL Outputs
output "web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "web_acl_arn" {
  description = "ARN of the WAF Web ACL for ALB association and logging configuration"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_capacity" {
  description = "Current capacity of the WAF Web ACL rules"
  value       = aws_wafv2_web_acl.main.capacity
}

# IP Set Outputs
output "ip_set_id" {
  description = "ID of the WAF IP set used for blocking/allowing IP addresses"
  value       = aws_wafv2_ip_set.blocked_ips.id
}

output "ip_set_arn" {
  description = "ARN of the WAF IP set for rule integration"
  value       = aws_wafv2_ip_set.blocked_ips.arn
}

# Logging Configuration Outputs
output "log_group_name" {
  description = "Name of the CloudWatch Log Group for WAF logs"
  value       = aws_cloudwatch_log_group.waf_logs.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch Log Group for WAF logging"
  value       = aws_cloudwatch_log_group.waf_logs.arn
}

# Shield Advanced Protection Output (if enabled)
output "shield_protection_id" {
  description = "ID of the Shield Advanced protection for the ALB (only in production)"
  value       = try(aws_shield_protection.alb[0].id, null)
}

# WAF Rules Outputs
output "managed_rule_set_names" {
  description = "List of AWS managed rule sets enabled in the WAF"
  value = [
    "AWS-AWSManagedRulesCommonRuleSet",
    "AWS-AWSManagedRulesSQLiRuleSet",
    "AWS-AWSManagedRulesKnownBadInputsRuleSet"
  ]
}

output "rate_limit_rule_metric_name" {
  description = "Metric name for the custom rate limit rule"
  value       = "CustomRateLimitRuleMetric"
}

# WAF Association Output
output "web_acl_association_id" {
  description = "ID of the WAF Web ACL association with the ALB"
  value       = aws_wafv2_web_acl_association.main.id
}

# Tags Output
output "resource_tags" {
  description = "Tags applied to WAF resources"
  value       = local.common_tags
}
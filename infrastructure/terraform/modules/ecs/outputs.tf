# Cluster Outputs
output "cluster_id" {
  description = "The ID of the ECS cluster for service association and resource management"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster for service discovery and DNS integration"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "The ARN of the ECS cluster for IAM policy and permission configuration"
  value       = aws_ecs_cluster.main.arn
}

# Service Outputs
output "service_arns" {
  description = "Map of service names to their ARNs for cross-stack reference and IAM policies"
  value       = {
    for k, v in aws_ecs_service.services : k => v.id
  }
}

output "service_names" {
  description = "List of all ECS service names for service discovery and monitoring configuration"
  value       = [
    for service in aws_ecs_service.services : service.name
  ]
}

# Task Definition Outputs
output "task_definitions" {
  description = "Map of service names to their active task definition ARNs for deployment tracking"
  value       = {
    for k, v in aws_ecs_service.services : k => v.task_definition
  }
}

# Security Group Outputs
output "service_security_groups" {
  description = "Map of service names to their associated security group IDs for network security management"
  value       = {
    for k, v in aws_ecs_service.services : k => v.network_configuration[0].security_groups
  }
}

# Service Discovery Outputs
output "service_discovery_namespaces" {
  description = "Map of service names to their service discovery namespace IDs for DNS-based service discovery"
  value       = {
    for k, v in aws_service_discovery_service.services : k => {
      namespace_id = aws_service_discovery_private_dns_namespace.main.id
      service_id   = v.id
      dns_name     = "${v.name}.${var.service_discovery_namespace}"
    }
  }
}

# Auto Scaling Outputs
output "autoscaling_targets" {
  description = "Map of service names to their auto scaling target ARNs for scaling policy management"
  value       = {
    for k, v in aws_appautoscaling_target.services : k => v.resource_id
  }
}

# CloudWatch Log Group
output "cloudwatch_log_group" {
  description = "The name of the CloudWatch Log Group for ECS container logs"
  value       = "/ecs/${var.cluster_name}"
}

# Capacity Provider Strategy
output "capacity_providers" {
  description = "List of capacity providers associated with the cluster"
  value       = aws_ecs_cluster_capacity_providers.main.capacity_providers
}

# Health Check Configuration
output "service_health_checks" {
  description = "Map of service names to their health check configurations"
  value       = {
    for k, v in var.services : k => {
      path                = v.health_check_path
      grace_period_seconds = var.health_check_grace_period
    }
  }
}
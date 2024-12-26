# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common configurations
locals {
  common_tags = merge(
    var.default_tags,
    {
      Environment = var.environment
      Cluster     = var.cluster_name
    }
  )

  # CloudWatch logging configuration
  logging_config = {
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.cluster_name}"
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }
}

# Get current AWS region
data "aws_region" "current" {}

# ECS Cluster with enhanced monitoring
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = local.common_tags
}

# CloudWatch Log Group for ECS execution logs
resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${var.cluster_name}/exec-logs"
  retention_in_days = 30
  tags             = local.common_tags
}

# ECS Capacity Providers association
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    weight            = 3
    capacity_provider = "FARGATE_SPOT"
  }
}

# Service Discovery Private DNS Namespace
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = var.service_discovery_namespace
  vpc_id      = data.aws_vpc.main.id
  description = "Service discovery namespace for ${var.cluster_name}"
  tags        = local.common_tags
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "services" {
  for_each = var.services

  family                   = "${var.cluster_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.task_cpu[each.key]
  memory                  = var.task_memory[each.key]
  execution_role_arn      = var.task_execution_role_arn
  task_role_arn           = aws_iam_role.task_role[each.key].arn

  container_definitions = jsonencode([
    merge(
      each.value,
      local.logging_config,
      {
        essential = true
        name      = each.key
        portMappings = [
          {
            containerPort = each.value.port
            protocol      = "tcp"
          }
        ]
        healthCheck = {
          command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.port}${each.value.health_check_path} || exit 1"]
          interval    = 30
          timeout     = 5
          retries     = 3
          startPeriod = 60
        }
      }
    )
  ])

  tags = merge(
    local.common_tags,
    {
      Service = each.key
    }
  )
}

# ECS Services
resource "aws_ecs_service" "services" {
  for_each = var.services

  name                              = each.key
  cluster                          = aws_ecs_cluster.main.id
  task_definition                  = aws_ecs_task_definition.services[each.key].arn
  desired_count                    = var.scaling_config[each.key].min_capacity
  launch_type                      = "FARGATE"
  platform_version                 = var.platform_version
  health_check_grace_period_seconds = var.health_check_grace_period

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.service_security_groups
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  enable_execute_command = var.enable_execute_command

  tags = merge(
    local.common_tags,
    {
      Service = each.key
    }
  )
}

# Service Discovery Service
resource "aws_service_discovery_service" "services" {
  for_each = var.services

  name = each.value.service_discovery_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(
    local.common_tags,
    {
      Service = each.key
    }
  )
}

# Auto Scaling
resource "aws_appautoscaling_target" "services" {
  for_each = var.services

  max_capacity       = var.scaling_config[each.key].max_capacity
  min_capacity       = var.scaling_config[each.key].min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU-based Auto Scaling
resource "aws_appautoscaling_policy" "cpu" {
  for_each = var.services

  name               = "${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.scaling_config[each.key].cpu_threshold
    scale_in_cooldown  = var.scaling_config[each.key].scale_in_cooldown
    scale_out_cooldown = var.scaling_config[each.key].scale_out_cooldown
  }
}

# Memory-based Auto Scaling
resource "aws_appautoscaling_policy" "memory" {
  for_each = var.services

  name               = "${each.key}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.scaling_config[each.key].memory_threshold
    scale_in_cooldown  = var.scaling_config[each.key].scale_in_cooldown
    scale_out_cooldown = var.scaling_config[each.key].scale_out_cooldown
  }
}

# Outputs for reference by other modules
output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "service_names" {
  description = "Map of service names to their ARNs"
  value       = { for k, v in aws_ecs_service.services : k => v.name }
}

output "task_definitions" {
  description = "Map of service task definition ARNs"
  value       = { for k, v in aws_ecs_task_definition.services : k => v.arn }
}
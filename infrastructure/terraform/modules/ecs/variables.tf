# Core Terraform configuration
terraform {
  required_version = ">=1.0.0"
}

# Environment name for resource tagging
variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod) for resource tagging"
}

# ECS cluster configuration
variable "cluster_name" {
  type        = string
  description = "Name of the ECS cluster to be created"
}

variable "container_insights" {
  type        = bool
  description = "Enable or disable CloudWatch Container Insights for the ECS cluster"
  default     = true
}

# Service configurations for microservices
variable "services" {
  type = map(object({
    name                  = string
    image                = string
    port                 = number
    health_check_path    = string
    service_discovery_name = string
  }))
  description = "Map of service configurations for each microservice in the enrollment system"
}

# Task resource allocations
variable "task_cpu" {
  type        = map(number)
  description = "CPU units to allocate for each service task (1024 units = 1 vCPU)"
}

variable "task_memory" {
  type        = map(number)
  description = "Memory (in MiB) to allocate for each service task"
}

# Auto-scaling configurations
variable "scaling_config" {
  type = map(object({
    min_capacity       = number
    max_capacity      = number
    cpu_threshold     = number
    memory_threshold  = number
    scale_in_cooldown  = number
    scale_out_cooldown = number
  }))
  description = "Auto-scaling configuration for each service including capacity limits, thresholds, and cooldown periods"
}

# Health check configuration
variable "health_check_grace_period" {
  type        = number
  description = "Grace period in seconds for ECS service health checks"
  default     = 60
}

# Network configuration
variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs where ECS tasks will be deployed for high availability"
}

# Default values validation
variable "default_tags" {
  type = map(string)
  description = "Default tags to apply to all resources"
  default = {
    ManagedBy = "terraform"
    Project   = "enrollment-system"
  }
}

# Service discovery configuration
variable "service_discovery_namespace" {
  type        = string
  description = "Name of the service discovery namespace for internal service communication"
  default     = "enrollment.local"
}

# Load balancer configuration
variable "load_balancer_config" {
  type = object({
    target_group_arn         = string
    container_name           = string
    container_port          = number
    deregistration_delay    = number
  })
  description = "Load balancer configuration for service registration"
}

# Capacity provider strategy
variable "capacity_provider_strategy" {
  type = list(object({
    capacity_provider = string
    weight           = number
    base             = number
  }))
  description = "Capacity provider strategy for the ECS cluster"
  default = [
    {
      capacity_provider = "FARGATE"
      weight           = 1
      base             = 1
    },
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 1
      base             = 0
    }
  ]
}

# Task execution role configuration
variable "task_execution_role_arn" {
  type        = string
  description = "ARN of the IAM role that the ECS task execution will use"
}

# Service security groups
variable "service_security_groups" {
  type        = list(string)
  description = "List of security group IDs to assign to ECS services"
}

# Enable execute command
variable "enable_execute_command" {
  type        = bool
  description = "Enable AWS ECS Exec for the services"
  default     = false
}

# Platform version
variable "platform_version" {
  type        = string
  description = "Platform version for the ECS tasks (LATEST, 1.4.0, etc.)"
  default     = "LATEST"
}
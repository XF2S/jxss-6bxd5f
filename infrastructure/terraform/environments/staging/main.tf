# Provider Versions:
# aws: ~> 5.0
# random: ~> 3.0
# time: ~> 0.9.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9.0"
    }
  }
  required_version = ">= 1.0"

  backend "s3" {
    bucket         = "enrollment-system-staging-tfstate"
    key            = "staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "enrollment-system-staging-tflock"
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  region      = "us-west-2"
  common_tags = {
    Environment        = "staging"
    Project           = "enrollment-system"
    ManagedBy         = "terraform"
    CostCenter        = "staging-ops"
    DataClassification = "confidential"
  }
}

# AWS Provider configuration for staging region
provider "aws" {
  region = local.region
  default_tags {
    tags = local.common_tags
  }
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# VPC Module for staging environment
module "vpc" {
  source = "../../modules/vpc"

  environment         = local.environment
  vpc_cidr           = var.vpc_config.vpc_cidr
  availability_zones = var.vpc_config.availability_zones
  
  public_subnet_cidrs  = var.vpc_config.public_subnet_cidrs
  private_subnet_cidrs = var.vpc_config.private_subnet_cidrs
  
  enable_nat_gateway      = var.vpc_config.enable_nat_gateway
  single_nat_gateway      = var.vpc_config.single_nat_gateway
  enable_vpn_gateway      = var.vpc_config.enable_vpn_gateway
  enable_flow_logs        = var.vpc_config.enable_flow_logs
  flow_logs_retention_days = var.vpc_config.flow_logs_retention_days

  tags = local.common_tags
}

# ECS Cluster with fixed capacity for staging
module "ecs" {
  source = "../../modules/ecs"

  environment        = local.environment
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  
  container_insights = var.ecs_config.container_insights
  capacity_providers = var.ecs_config.capacity_providers
  task_cpu          = var.ecs_config.task_cpu
  task_memory       = var.ecs_config.task_memory
  min_capacity      = var.ecs_config.min_capacity
  max_capacity      = var.ecs_config.max_capacity

  tags = local.common_tags
}

# RDS Multi-AZ deployment for staging
module "rds" {
  source = "../../modules/rds"

  environment         = local.environment
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  
  instance_class     = var.rds_config.instance_class
  allocated_storage  = var.rds_config.allocated_storage
  max_allocated_storage = var.rds_config.max_allocated_storage
  
  multi_az          = var.rds_config.multi_az
  backup_retention_period = var.rds_config.backup_retention_period
  deletion_protection = var.rds_config.deletion_protection
  storage_encrypted = var.rds_config.storage_encrypted
  
  monitoring_interval = var.rds_config.monitoring_interval
  performance_insights_enabled = var.rds_config.performance_insights_enabled
  performance_insights_retention_period = var.rds_config.performance_insights_retention_period

  tags = local.common_tags
}

# ElastiCache Redis cluster for staging
module "elasticache" {
  source = "../../modules/elasticache"

  environment     = local.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  
  node_type      = var.elasticache_config.node_type
  num_cache_nodes = var.elasticache_config.num_cache_nodes
  engine_version = var.elasticache_config.engine_version
  port          = var.elasticache_config.port
  
  automatic_failover_enabled = var.elasticache_config.automatic_failover

  tags = local.common_tags
}

# Enhanced monitoring and alerting for staging
module "monitoring" {
  source = "../../modules/monitoring"

  environment = local.environment
  vpc_id     = module.vpc.vpc_id
  
  log_retention_days = var.monitoring_config.log_retention_days
  enable_detailed_monitoring = var.monitoring_config.enable_detailed_monitoring
  
  alarm_evaluation_periods = var.monitoring_config.alarm_evaluation_periods
  alarm_datapoints_required = var.monitoring_config.alarm_datapoints_required
  
  # Monitoring resources
  rds_instance_id = module.rds.endpoint
  ecs_cluster_id  = module.ecs.cluster_id
  cache_cluster_id = module.elasticache.endpoint
  vpc_flow_logs_group = module.vpc.flow_logs_bucket

  tags = local.common_tags
}

# Security configuration for staging
module "security" {
  source = "../../modules/security"

  environment = local.environment
  vpc_id     = module.vpc.vpc_id
  
  enable_waf        = var.security_config.enable_waf
  waf_rule_size     = var.security_config.waf_rule_size
  ssl_policy        = var.security_config.ssl_policy
  enable_shield     = var.security_config.enable_shield
  enable_securityhub = var.security_config.enable_securityhub
  enable_guardduty   = var.security_config.enable_guardduty

  tags = local.common_tags
}

# Outputs for staging environment
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_id" {
  description = "ID of the staging ECS cluster"
  value       = module.ecs.cluster_id
}

output "monitoring_config" {
  description = "Monitoring configuration details"
  value = {
    log_group_name = module.monitoring.log_group_name
    metrics_namespace = "Staging/EnrollmentSystem"
    alarm_sns_topic = module.monitoring.alarm_sns_topic_arn
  }
  sensitive = true
}
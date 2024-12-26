# Provider Configurations
# AWS Provider version: ~> 5.0
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
  }

  required_version = ">= 1.0.0"

  backend "s3" {
    # Backend configuration should be provided via backend config file
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local Variables
locals {
  common_tags = {
    Environment       = var.environment
    Project          = "enrollment-system"
    ManagedBy        = "terraform"
    Owner            = "platform-team"
    CostCenter       = "enrollment-${var.environment}"
    SecurityZone     = "restricted"
    DataClassification = "sensitive"
  }

  # Computed variables for resource naming
  name_prefix = "enrollment-${var.environment}"
}

# Random string for unique naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  
  # VPC Configuration
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "prod"
  enable_vpn_gateway = var.environment == "prod"
  
  # DNS Configuration
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Tags
  tags = local.common_tags
}

# ECS Cluster Module
module "ecs" {
  source = "./modules/ecs"

  environment     = var.environment
  cluster_name    = "${local.name_prefix}-cluster"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  # Auto Scaling Configuration
  min_capacity     = var.autoscaling_config.min_capacity
  max_capacity     = var.autoscaling_config.max_capacity
  target_cpu       = var.autoscaling_config.target_cpu
  target_memory    = var.autoscaling_config.target_memory
  
  # Service Discovery
  enable_service_discovery = true
  namespace_name          = "${local.name_prefix}.local"

  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  identifier     = "${local.name_prefix}-db-${random_string.suffix.result}"
  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  
  # Database Configuration
  engine            = var.db_config.engine
  engine_version    = var.db_config.engine_version
  instance_class    = var.db_config.instance_class
  allocated_storage = var.db_config.allocated_storage
  storage_type      = var.db_config.storage_type
  
  # High Availability
  multi_az          = var.db_config.multi_az
  backup_retention_period = var.backup_retention
  
  # Security
  username          = var.db_config.username
  password          = var.db_config.password
  port              = var.db_config.port
  parameter_family  = var.db_config.parameter_family
  
  # Enhanced Monitoring
  monitoring_interval = var.enable_monitoring ? 30 : 0
  
  tags = local.common_tags
}

# ElastiCache Module for Redis
module "elasticache" {
  source = "./modules/elasticache"

  cluster_id           = "${local.name_prefix}-cache"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  node_type           = var.elasticache_config.node_type
  num_cache_nodes     = var.elasticache_config.num_cache_nodes
  engine_version      = var.elasticache_config.engine_version
  port                = var.elasticache_config.port
  
  # Security
  security_group_ids  = [module.vpc.default_security_group_id]
  
  tags = local.common_tags
}

# CloudWatch Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  environment     = var.environment
  retention_days = var.monitoring_config.retention_days
  alarm_email    = var.monitoring_config.alarm_email
  
  # Resources to Monitor
  ecs_cluster_name = module.ecs.cluster_name
  rds_identifier  = module.rds.cluster_identifier
  vpc_id          = module.vpc.vpc_id
  
  # Dashboard
  enable_dashboard = var.monitoring_config.enable_dashboard
  
  tags = local.common_tags
}

# Security Configuration
module "security" {
  source = "./modules/security"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  ssl_certificate_arn = var.security_config.ssl_certificate_arn
  allowed_cidr_blocks = var.security_config.allowed_cidr_blocks
  
  # WAF & Shield
  enable_waf    = var.security_config.enable_waf
  enable_shield = var.security_config.enable_shield
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "ID of the created VPC"
}

output "ecs_cluster_id" {
  value       = module.ecs.cluster_id
  description = "ID of the ECS cluster"
}

output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "Endpoint of the RDS database cluster"
  sensitive   = true
}

output "rds_reader_endpoint" {
  value       = module.rds.reader_endpoint
  description = "Reader endpoint of the RDS database cluster"
  sensitive   = true
}

output "elasticache_endpoint" {
  value       = module.elasticache.endpoint
  description = "Endpoint of the ElastiCache cluster"
  sensitive   = true
}

output "cloudwatch_log_group" {
  value       = module.monitoring.log_group_name
  description = "Name of the CloudWatch log group"
}
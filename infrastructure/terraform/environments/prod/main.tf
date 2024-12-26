# Production Environment Infrastructure Configuration
# AWS Provider Version: ~> 5.0
# Last Updated: 2024

terraform {
  required_version = ">= 1.5.0"
  
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

  backend "s3" {
    bucket         = "enrollment-system-tfstate-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "enrollment-system-tfstate-lock-prod"
    kms_key_id     = "alias/terraform-bucket-key"
  }
}

# Provider configuration with enhanced security features
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/EnrollmentSystemTerraformRole"
  }
}

# Local variables for resource naming and tagging
locals {
  common_tags = {
    Environment         = "production"
    Project            = "enrollment-system"
    ManagedBy          = "terraform"
    CostCenter         = "enrollment"
    DataClassification = "restricted"
    Compliance         = "ferpa"
  }

  name_prefix = "enrollment-${var.environment}"
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# VPC Module - Production Network Infrastructure
module "vpc" {
  source = "../../modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  enable_flow_logs    = true
  flow_logs_retention = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# WAF Module - Enhanced Security Rules
module "waf" {
  source = "../../modules/waf"

  environment = var.environment
  
  rules = {
    rate_limit = {
      priority = 1
      limit    = 2000
    }
    ip_reputation = {
      priority = 2
      block_list = ["KNOWN_MALICIOUS_IP"]
    }
    sql_injection = {
      priority = 3
      action   = "block"
    }
  }

  tags = local.common_tags
}

# ECS Cluster - Container Orchestration
module "ecs" {
  source = "../../modules/ecs"

  cluster_name = "${local.name_prefix}-cluster"
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  
  default_capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE"
      weight           = 60
      base            = 1
    },
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 40
    }
  ]

  enable_container_insights = true

  tags = local.common_tags
}

# RDS Module - Production Database
module "rds" {
  source = "../../modules/rds"

  identifier = "${local.name_prefix}-db-${random_string.suffix.result}"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  engine         = "postgres"
  engine_version = "14.7"
  
  instance_class              = var.db_config.instance_class
  allocated_storage          = var.db_config.allocated_storage
  max_allocated_storage      = var.db_config.max_allocated_storage
  backup_retention_period    = var.db_config.backup_retention_period
  multi_az                   = var.db_config.multi_az
  deletion_protection        = var.db_config.deletion_protection
  performance_insights_enabled = var.db_config.performance_insights_enabled
  monitoring_interval        = var.db_config.monitoring_interval

  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db"
  })
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-key"
  })
}

# CloudWatch Enhanced Monitoring
resource "aws_cloudwatch_dashboard" "main" {
  count          = var.enable_monitoring ? 1 : 0
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", module.rds.identifier],
            ["AWS/ECS", "CPUUtilization", "ClusterName", module.ecs.cluster_id]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "System CPU Utilization"
        }
      }
    ]
  })
}

# Outputs for other modules/configurations
output "vpc_id" {
  description = "Production VPC identifier"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_arn" {
  description = "Production ECS cluster ARN"
  value       = module.ecs.cluster_id
}

output "waf_web_acl_id" {
  description = "Production WAF Web ACL ID"
  value       = module.waf.web_acl_id
}
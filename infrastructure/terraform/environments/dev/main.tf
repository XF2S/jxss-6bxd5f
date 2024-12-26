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

  backend "s3" {
    bucket         = "enrollment-system-dev-tfstate"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "enrollment-system-dev-tflock"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local Variables
locals {
  common_tags = {
    Environment       = "dev"
    Project          = "enrollment-system"
    ManagedBy        = "terraform"
    CostCenter       = "development"
    AutoShutdown     = "true"
    SecurityLevel    = "development"
  }

  name_prefix = "enrollment-sys-${var.environment}"
}

# Random ID for unique naming
resource "random_id" "unique" {
  byte_length = 4
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-${random_id.unique.hex}"
  })
}

# ECS Cluster Module
module "ecs" {
  source = "../../modules/ecs"

  environment     = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  
  cluster_config = {
    name                = "${local.name_prefix}-cluster"
    capacity_providers  = ["FARGATE", "FARGATE_SPOT"]
    default_capacity_provider = "FARGATE_SPOT"
    container_insights  = true
  }

  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  
  db_config = merge(var.db_config, {
    identifier        = "${local.name_prefix}-db-${random_id.unique.hex}"
    engine           = "postgres"
    engine_version   = "14.7"
    port             = 5432
    username         = "dbadmin"
    password         = random_password.db_password.result
  })

  tags = local.common_tags
}

# Generate secure database password
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/enrollment-system/${var.environment}"
  retention_in_days = 30
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-logs"
  })
}

# Security Group for Application
resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-app-sg"
  description = "Security group for development application tier"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-sg"
  })
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for development ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

# Outputs
output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "ID of the development VPC"
}

output "ecs_cluster_details" {
  value = {
    cluster_id   = module.ecs.cluster_id
    cluster_name = module.ecs.cluster_name
    namespace_id = module.ecs.service_discovery_namespace
  }
  description = "Development ECS cluster details"
}

output "database_connection" {
  value = {
    endpoint     = module.rds.endpoint
    database_name = module.rds.database_name
    port         = 5432
  }
  sensitive   = true
  description = "Development database connection details"
}
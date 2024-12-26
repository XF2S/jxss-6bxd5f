# Provider version constraints
# AWS Provider ~> 5.0
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
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.environment}-enrollment"
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Project     = "enrollment-system"
      ManagedBy   = "terraform"
    }
  )
}

# Random string for unique DB identifier
resource "random_string" "db_identifier_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Random password for master DB user
resource "random_password" "master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# DB Parameter Group for PostgreSQL optimization
resource "aws_db_parameter_group" "enrollment" {
  name        = "${local.name_prefix}-pg14-params-${random_string.db_identifier_suffix.result}"
  family      = var.parameter_family
  description = "Custom parameter group for Enrollment System PostgreSQL 14+"

  # Performance and connection parameters
  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "work_mem"
    value = "4096"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "1048576"
  }

  # Query optimization parameters
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameter {
    name  = "checkpoint_timeout"
    value = "900"
  }

  # Logging and monitoring
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = local.common_tags
}

# DB Subnet Group
resource "aws_db_subnet_group" "enrollment" {
  name        = "${local.name_prefix}-subnet-group-${random_string.db_identifier_suffix.result}"
  description = "Subnet group for Enrollment System RDS instance"
  subnet_ids  = var.private_subnet_ids

  tags = local.common_tags
}

# Security Group for RDS
resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db-sg-${random_string.db_identifier_suffix.result}"
  description = "Security group for Enrollment System RDS instance"
  vpc_id      = var.vpc_id

  # Ingress rule for PostgreSQL
  ingress {
    description = "PostgreSQL access from within VPC"
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  # Egress rule
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# Enhanced monitoring IAM role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name               = "${local.name_prefix}-rds-monitoring-${random_string.db_identifier_suffix.result}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]
  tags               = local.common_tags
}

# RDS Instance
resource "aws_db_instance" "enrollment" {
  identifier = "${local.name_prefix}-db-${random_string.db_identifier_suffix.result}"

  # Engine configuration
  engine                      = "postgres"
  engine_version             = var.engine_version
  instance_class             = var.instance_class
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.max_allocated_storage
  storage_type               = "gp3"
  storage_encrypted          = true
  kms_key_id                = var.kms_key_arn

  # Database configuration
  db_name  = var.db_name
  username = "enrollment_admin"
  password = random_password.master_password.result
  port     = var.port

  # Network configuration
  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.enrollment.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.enrollment.name

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  copy_tags_to_snapshot  = true

  # Maintenance configuration
  maintenance_window          = var.maintenance_window
  auto_minor_version_upgrade = true

  # Monitoring configuration
  monitoring_interval             = var.monitoring_interval
  monitoring_role_arn            = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled    = var.performance_insights_enabled
  performance_insights_retention_period = 731 # 2 years
  performance_insights_kms_key_id = var.kms_key_arn

  # Security configuration
  deletion_protection      = var.deletion_protection
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot-${random_string.db_identifier_suffix.result}"

  # Enhanced features
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      password,
      final_snapshot_identifier
    ]
  }
}

# Data source for VPC CIDR
data "aws_vpc" "selected" {
  id = var.vpc_id
}

# SSM Parameter for database endpoint
resource "aws_ssm_parameter" "db_endpoint" {
  name        = "/${var.environment}/enrollment/db/endpoint"
  description = "Enrollment System Database Endpoint"
  type        = "String"
  value       = aws_db_instance.enrollment.endpoint
  tags        = local.common_tags
}

# SSM Parameter for database master password
resource "aws_ssm_parameter" "db_master_password" {
  name        = "/${var.environment}/enrollment/db/master_password"
  description = "Enrollment System Database Master Password"
  type        = "SecureString"
  value       = random_password.master_password.result
  tags        = local.common_tags
}
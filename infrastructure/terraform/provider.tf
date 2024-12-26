# Provider version: ~> 5.0
# Random provider version: ~> 3.5

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# AWS Provider Configuration with enhanced security and compliance features
provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Environment         = var.environment
      Project            = "enrollment-system"
      ManagedBy         = "terraform"
      SecurityCompliance = "FERPA"
      DataClassification = "sensitive"
      BackupRequired    = "true"
      LastUpdated       = timestamp()
    }
  }

  # Enhanced security and compliance configurations
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
  }

  # Default encryption configuration
  default_tags {
    tags = {
      EncryptionRequired = "true"
      EncryptionAlgorithm = "AES-256-GCM"
      TLSVersion         = "TLS1.3"
    }
  }

  # Enhanced provider-level configurations
  endpoints {
    s3 = {
      enforce_ssl = true
    }
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}

# Provider feature flags and configurations
provider "aws" {
  alias = "logging"
  region = "us-east-1" # CloudWatch Logs central region

  default_tags {
    tags = {
      LogRetention = "365"
      AuditEnabled = "true"
      MonitoringLevel = "detailed"
    }
  }
}

# Additional provider configurations for cross-region resources
provider "aws" {
  alias = "dr" # Disaster recovery region
  region = "us-west-2" # Secondary region for DR

  default_tags {
    tags = {
      ReplicationType = "disaster-recovery"
      SyncEnabled     = "true"
    }
  }
}

# Random provider for secure resource naming
provider "random" {}

# Provider-level security policies
resource "aws_iam_account_alias" "alias" {
  account_alias = "enrollment-system-${var.environment}"
}

# Account-wide security settings
resource "aws_s3_account_public_access_block" "account" {
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable AWS CloudTrail for comprehensive logging
resource "aws_cloudtrail" "compliance_trail" {
  name                          = "enrollment-system-audit-trail"
  s3_bucket_name               = "enrollment-system-audit-logs-${var.environment}"
  include_global_service_events = true
  is_multi_region_trail        = true
  enable_logging               = true
  kms_key_id                  = aws_kms_key.cloudtrail.arn

  tags = {
    ComplianceRequired = "true"
    DataRetention     = "365"
  }
}

# KMS key for CloudTrail encryption
resource "aws_kms_key" "cloudtrail" {
  description             = "KMS key for CloudTrail encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudTrail to encrypt logs"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}
# AWS Provider version: ~> 5.0

# Configure Terraform backend using S3 for state storage and DynamoDB for state locking
terraform {
  backend "s3" {
    # Primary state storage configuration
    bucket         = "enrollment-system-terraform-state"
    key            = "${var.environment}/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    
    # State locking configuration using DynamoDB
    dynamodb_table = "enrollment-system-terraform-locks"
    
    # Security and access control
    acl            = "private"
    
    # Enable versioning for state file history
    versioning     = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }
    
    # Access logging configuration
    logging {
      target_bucket = "enrollment-system-logs"
      target_prefix = "terraform-state-access-logs/"
    }
    
    # Additional security configurations
    force_destroy = false
    
    # Lifecycle rules for state file versions
    lifecycle_rule {
      enabled = true
      
      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
      
      noncurrent_version_expiration {
        days = 90
      }
    }
    
    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      
      rules {
        id     = "terraform-state-replication"
        status = "Enabled"
        
        destination {
          bucket        = "arn:aws:s3:::enrollment-system-terraform-state-dr"
          storage_class = "STANDARD_IA"
          
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:REGION:ACCOUNT_ID:key/DR-KEY-ID"
          }
        }
      }
    }
    
    # Enable MFA delete protection
    mfa_delete = true
    
    # Enable object lock for compliance
    object_lock_configuration {
      object_lock_enabled = "Enabled"
    }
  }
}

# Backend configuration validation
locals {
  backend_validation = {
    environment_valid = contains(["dev", "staging", "prod"], var.environment)
    region_valid     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9]$", var.aws_region))
  }
}

# Ensure backend validation passes
resource "null_resource" "backend_validation" {
  count = local.backend_validation.environment_valid && local.backend_validation.region_valid ? 0 : "Backend validation failed"
}

# Output backend configuration status
output "backend_configuration" {
  value = {
    state_bucket     = "enrollment-system-terraform-state"
    state_key        = "${var.environment}/terraform.tfstate"
    lock_table       = "enrollment-system-terraform-locks"
    encryption       = "AES256"
    versioning       = "Enabled"
    logging_enabled  = true
    replication     = "Cross-region enabled"
    mfa_delete      = true
    object_lock     = "Enabled"
  }
  description = "Backend configuration details for the Terraform state"
}
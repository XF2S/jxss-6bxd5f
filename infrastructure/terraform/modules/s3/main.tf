# AWS Provider configuration
# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Document Storage Bucket
resource "aws_s3_bucket" "document_storage" {
  bucket = "${var.project_name}-${var.environment}-documents"
  tags   = merge(var.tags, { Purpose = "Document Storage" })

  # Prevent accidental deletion of bucket with documents
  force_destroy = false
}

# Block Public Access for Document Storage
resource "aws_s3_bucket_public_access_block" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Document Storage Bucket Policy
resource "aws_s3_bucket_policy" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.document_storage.arn,
          "${aws_s3_bucket.document_storage.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Versioning Configuration for Document Storage
resource "aws_s3_bucket_versioning" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id
  versioning_configuration {
    status = var.document_storage_versioning ? "Enabled" : "Disabled"
  }
}

# Server-Side Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle Configuration for Document Storage
resource "aws_s3_bucket_lifecycle_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = var.document_lifecycle_transition_days
      storage_class = "STANDARD_IA"
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Static Assets Bucket (Conditional Creation)
resource "aws_s3_bucket" "static_assets" {
  count  = var.enable_static_assets ? 1 : 0
  bucket = "${var.project_name}-${var.environment}-static"
  tags   = merge(var.tags, { Purpose = "Static Assets" })
}

# CORS Configuration for Static Assets
resource "aws_s3_bucket_cors_configuration" "static_assets" {
  count  = var.enable_static_assets ? 1 : 0
  bucket = aws_s3_bucket.static_assets[0].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Website Configuration for Static Assets
resource "aws_s3_bucket_website_configuration" "static_assets" {
  count  = var.enable_static_assets ? 1 : 0
  bucket = aws_s3_bucket.static_assets[0].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Output values for use in other modules
output "document_storage_bucket" {
  value = {
    id                          = aws_s3_bucket.document_storage.id
    arn                         = aws_s3_bucket.document_storage.arn
    bucket_domain_name          = aws_s3_bucket.document_storage.bucket_domain_name
    bucket_regional_domain_name = aws_s3_bucket.document_storage.bucket_regional_domain_name
  }
  description = "Document storage bucket details"
}

output "static_assets_bucket" {
  value = var.enable_static_assets ? {
    id                          = aws_s3_bucket.static_assets[0].id
    arn                         = aws_s3_bucket.static_assets[0].arn
    website_endpoint           = aws_s3_bucket.static_assets[0].website_endpoint
    bucket_regional_domain_name = aws_s3_bucket.static_assets[0].bucket_regional_domain_name
  } : null
  description = "Static assets bucket details (if enabled)"
}
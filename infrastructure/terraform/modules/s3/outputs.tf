# Document Storage Bucket Outputs
output "document_storage_bucket_id" {
  description = "ID of the S3 bucket used for secure document storage and management"
  value       = aws_s3_bucket.document_storage.id
}

output "document_storage_bucket_arn" {
  description = "ARN of the S3 bucket used for document storage, required for IAM policy configuration"
  value       = aws_s3_bucket.document_storage.arn
}

output "document_storage_bucket_domain" {
  description = "Domain name of the S3 bucket used for document storage with SSL/TLS support"
  value       = aws_s3_bucket.document_storage.bucket_domain_name
}

# Backup Storage Bucket Outputs (Conditional)
output "backup_storage_bucket_id" {
  description = "ID of the S3 bucket used for encrypted backup storage (conditional)"
  value       = var.enable_backup_storage ? aws_s3_bucket.backup_storage[0].id : null
}

output "backup_storage_bucket_arn" {
  description = "ARN of the S3 bucket used for backup storage, required for backup IAM roles"
  value       = var.enable_backup_storage ? aws_s3_bucket.backup_storage[0].arn : null
}

output "backup_storage_bucket_domain" {
  description = "Domain name of the S3 bucket used for backup storage with encryption in transit"
  value       = var.enable_backup_storage ? aws_s3_bucket.backup_storage[0].bucket_domain_name : null
}

# Static Assets Bucket Outputs (Conditional)
output "static_assets_bucket_id" {
  description = "ID of the S3 bucket used for static assets delivery (conditional)"
  value       = var.enable_static_assets ? aws_s3_bucket.static_assets[0].id : null
}

output "static_assets_bucket_arn" {
  description = "ARN of the S3 bucket used for static assets, required for CloudFront and IAM"
  value       = var.enable_static_assets ? aws_s3_bucket.static_assets[0].arn : null
}

output "static_assets_bucket_domain" {
  description = "Domain name of the S3 bucket used for static assets delivery via CloudFront"
  value       = var.enable_static_assets ? aws_s3_bucket.static_assets[0].bucket_domain_name : null
}

# Composite Outputs for Module Integration
output "document_storage_bucket_outputs" {
  description = "Complete set of document storage bucket attributes for service integration"
  value = {
    id     = aws_s3_bucket.document_storage.id
    arn    = aws_s3_bucket.document_storage.arn
    domain = aws_s3_bucket.document_storage.bucket_domain_name
  }
}

output "backup_storage_bucket_outputs" {
  description = "Complete set of backup storage bucket attributes for backup service configuration"
  value = var.enable_backup_storage ? {
    id     = aws_s3_bucket.backup_storage[0].id
    arn    = aws_s3_bucket.backup_storage[0].arn
    domain = aws_s3_bucket.backup_storage[0].bucket_domain_name
  } : null
}

output "static_assets_bucket_outputs" {
  description = "Complete set of static assets bucket attributes for CloudFront CDN integration"
  value = var.enable_static_assets ? {
    id     = aws_s3_bucket.static_assets[0].id
    arn    = aws_s3_bucket.static_assets[0].arn
    domain = aws_s3_bucket.static_assets[0].bucket_domain_name
  } : null
}
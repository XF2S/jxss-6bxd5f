# Network Infrastructure Outputs
output "vpc_id" {
  description = "The ID of the VPC for resource association and network configuration"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure application and database deployment across availability zones"
  value       = module.vpc.private_subnet_ids
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer and public-facing resource deployment"
  value       = module.vpc.public_subnet_ids
  sensitive   = false
}

# ECS Cluster Outputs
output "ecs_cluster_id" {
  description = "The ID of the ECS cluster for service deployment and task execution"
  value       = module.ecs.cluster_id
  sensitive   = false
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster for service discovery and monitoring"
  value       = module.ecs.cluster_name
  sensitive   = false
}

# Database Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL database"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "The port number for RDS PostgreSQL database connections"
  value       = module.rds.port
  sensitive   = false
}

# Cache Outputs
output "redis_endpoint" {
  description = "The connection endpoint for the Redis cache cluster"
  value       = module.elasticache.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "The port number for Redis cache cluster connections"
  value       = module.elasticache.redis_port
  sensitive   = false
}

# Storage Outputs
output "document_bucket_name" {
  description = "The name of the S3 bucket for document storage with versioning and encryption"
  value       = module.s3.document_storage_bucket.id
  sensitive   = false
}

output "static_assets_bucket_name" {
  description = "The name of the S3 bucket for static assets delivery through CDN"
  value       = module.s3.static_assets_bucket != null ? module.s3.static_assets_bucket.id : null
  sensitive   = false
}

# Additional Network Outputs
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for security group and network planning"
  value       = module.vpc.vpc_cidr_block
  sensitive   = false
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs for private subnet internet access"
  value       = module.vpc.nat_gateway_ids
  sensitive   = false
}

# Security Outputs
output "document_bucket_arn" {
  description = "The ARN of the document storage bucket for IAM policy configuration"
  value       = module.s3.document_storage_bucket.arn
  sensitive   = false
}

output "static_assets_bucket_domain" {
  description = "The regional domain name of the static assets bucket for CDN configuration"
  value       = module.s3.static_assets_bucket != null ? module.s3.static_assets_bucket.bucket_regional_domain_name : null
  sensitive   = false
}

# Monitoring Outputs
output "vpc_flow_log_group" {
  description = "The name of the CloudWatch Log Group for VPC flow logs"
  value       = module.vpc.vpc_flow_log_group
  sensitive   = false
}

# Service Discovery Outputs
output "private_hosted_zone_id" {
  description = "The ID of the private hosted zone for service discovery"
  value       = module.vpc.vpc_id
  sensitive   = false
}

# Availability Zone Outputs
output "availability_zones" {
  description = "List of availability zones used for high availability deployment"
  value       = module.vpc.availability_zones
  sensitive   = false
}
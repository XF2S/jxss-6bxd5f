# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Redis Parameter Group with optimized cache settings
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7.0"
  name        = "${var.project}-${var.environment}-redis-params"
  description = "Redis parameter group for ${var.project} ${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  tags = var.tags
}

# Subnet Group for Redis cluster network placement
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.project}-${var.environment}-redis-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for ${var.project} ${var.environment} Redis cluster"
  tags        = var.tags
}

# Security Group for Redis cluster access control
resource "aws_security_group" "redis" {
  name        = "${var.project}-${var.environment}-redis-sg"
  vpc_id      = var.vpc_id
  description = "Security group for ${var.project} ${var.environment} Redis cluster"

  ingress {
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Redis port access"
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = var.tags
}

# Redis Cluster with encryption and high availability
resource "aws_elasticache_cluster" "redis" {
  cluster_id                  = "${var.project}-${var.environment}-redis"
  engine                      = "redis"
  engine_version             = "7.0"
  node_type                  = var.node_type
  num_cache_nodes            = var.num_cache_nodes
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  port                       = var.port
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  
  # Encryption settings
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Backup and maintenance settings
  snapshot_retention_limit   = 7
  snapshot_window           = "03:00-05:00"
  maintenance_window        = "mon:05:00-mon:07:00"
  
  # Monitoring and notifications
  notification_topic_arn    = var.notification_topic_arn
  
  tags = var.tags
}

# Outputs for use in other modules
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_cluster.redis.port
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "redis_parameter_group_name" {
  description = "Name of the Redis parameter group"
  value       = aws_elasticache_parameter_group.redis.name
}

output "redis_subnet_group_name" {
  description = "Name of the Redis subnet group"
  value       = aws_elasticache_subnet_group.redis.name
}
# Redis endpoint information
output "redis_endpoint" {
  description = "Redis cluster endpoint URL for application connection"
  value       = aws_elasticache_cluster.redis.endpoint
}

output "redis_port" {
  description = "Redis cluster port number for application connection"
  value       = aws_elasticache_cluster.redis.port
}

output "redis_connection_string" {
  description = "Complete Redis connection string for application configuration"
  value       = "${aws_elasticache_cluster.redis.endpoint}:${aws_elasticache_cluster.redis.port}"
}

# Cluster identification
output "redis_cluster_id" {
  description = "Redis cluster identifier for resource management and monitoring"
  value       = aws_elasticache_cluster.redis.cluster_id
}

# Security group information
output "redis_security_group_id" {
  description = "Security group ID controlling access to Redis cluster"
  value       = aws_security_group.redis.id
}

output "redis_security_group_name" {
  description = "Security group name for Redis cluster access control"
  value       = aws_security_group.redis.name
}
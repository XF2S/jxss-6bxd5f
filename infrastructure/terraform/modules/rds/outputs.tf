# Database connection information
output "db_endpoint" {
  description = "Complete PostgreSQL connection endpoint in host:port format for application tier configuration"
  value       = aws_db_instance.enrollment.endpoint
  sensitive   = true
}

output "db_host" {
  description = "RDS instance hostname for database connection string configuration"
  value       = aws_db_instance.enrollment.address
  sensitive   = true
}

output "db_port" {
  description = "PostgreSQL port number for database access configuration"
  value       = aws_db_instance.enrollment.port
  sensitive   = false
}

# Resource identifiers
output "db_arn" {
  description = "Amazon Resource Name (ARN) of the RDS instance for IAM and monitoring configuration"
  value       = aws_db_instance.enrollment.arn
  sensitive   = false
}

output "db_id" {
  description = "Unique identifier of the RDS instance for resource management"
  value       = aws_db_instance.enrollment.id
  sensitive   = false
}

# Network configuration
output "db_subnet_group_id" {
  description = "ID of the DB subnet group for network and VPC configuration"
  value       = aws_db_subnet_group.enrollment.id
  sensitive   = false
}

output "db_security_group_id" {
  description = "ID of the security group controlling database access"
  value       = aws_security_group.db.id
  sensitive   = false
}
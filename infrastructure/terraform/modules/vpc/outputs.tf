# VPC Identifier output
output "vpc_id" {
  description = "The ID of the VPC for resource association and network configuration"
  value       = aws_vpc.main.id
}

# VPC CIDR Block output
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.main.cidr_block
}

# Public Subnet IDs output
output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer and public-facing resource deployment across availability zones"
  value       = aws_subnet.public[*].id
}

# Private Subnet IDs output
output "private_subnet_ids" {
  description = "List of private subnet IDs for secure application and database deployment across availability zones"
  value       = aws_subnet.private[*].id
}

# Public Subnet CIDR blocks output
output "public_subnet_cidrs" {
  description = "List of public subnet CIDR blocks for network planning and security group rules"
  value       = aws_subnet.public[*].cidr_block
}

# Private Subnet CIDR blocks output
output "private_subnet_cidrs" {
  description = "List of private subnet CIDR blocks for network planning and security group rules"
  value       = aws_subnet.private[*].cidr_block
}

# NAT Gateway IDs output
output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs for private subnet internet access configuration and route table association"
  value       = var.enable_nat_gateway ? aws_nat_gateway.main[*].id : []
}

# Additional outputs for network configuration
output "internet_gateway_id" {
  description = "The ID of the Internet Gateway for public subnet internet access"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "The ID of the public route table for custom route configuration"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of private route table IDs for custom route configuration"
  value       = var.enable_nat_gateway ? aws_route_table.private[*].id : []
}

output "vpc_flow_log_group" {
  description = "The name of the CloudWatch Log Group for VPC Flow Logs if enabled"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.flow_logs[0].name : null
}

output "vpc_default_network_acl_id" {
  description = "The ID of the default Network ACL for the VPC"
  value       = aws_default_network_acl.main.id
}

output "availability_zones" {
  description = "List of availability zones used for VPC subnet distribution"
  value       = var.availability_zones
}
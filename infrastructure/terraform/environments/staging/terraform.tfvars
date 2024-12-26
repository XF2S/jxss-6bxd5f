# Project and Environment Configuration
environment = "staging"
aws_region  = "us-west-2"
project_name = "enrollment-system"

# VPC Configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# Subnet Configuration
public_subnet_cidrs = [
  "10.1.1.0/24",
  "10.1.2.0/24",
  "10.1.3.0/24"
]
private_subnet_cidrs = [
  "10.1.4.0/24",
  "10.1.5.0/24",
  "10.1.6.0/24"
]
enable_nat_gateway = true
single_nat_gateway = true

# Database Configuration
db_config = {
  instance_class          = "db.t3.large"
  engine                  = "postgres"
  engine_version         = "14.7"
  allocated_storage      = 100
  max_allocated_storage  = 500
  storage_type           = "gp3"
  multi_az              = true
  username              = "enrollment_admin"
  password              = "TO_BE_SET_BY_SECRETS_MANAGER"
  port                  = 5432
  parameter_family      = "postgres14"
  deletion_protection   = true
  backup_retention_period = 7
  encryption_enabled     = true
  performance_insights_enabled = true
}

# Monitoring Configuration
enable_monitoring = true
monitoring_config = {
  retention_days = 30
  enable_dashboard = true
  alarm_email = "platform-team@enrollment-system.com"
  enhanced_monitoring_interval = 60
  alarm_cpu_threshold = 70
  alarm_memory_threshold = 80
  alarm_storage_threshold = 85
}

# Auto Scaling Configuration
autoscaling_config = {
  min_capacity = 2
  max_capacity = 6
  target_cpu = 70
  target_memory = 80
  scale_in_cooldown = 300
  scale_out_cooldown = 180
}

# Security Configuration
security_config = {
  enable_encryption = true
  ssl_certificate_arn = "arn:aws:acm:us-west-2:ACCOUNT_ID:certificate/CERTIFICATE_ID"
  allowed_cidr_blocks = ["10.0.0.0/8"]
  enable_waf = true
  enable_shield = true
}

# Cache Configuration
elasticache_config = {
  node_type = "cache.t3.medium"
  num_cache_nodes = 2
  engine_version = "7.0"
  port = 6379
}

# DNS Configuration
dns_config = {
  domain_name = "staging.enrollment-system.com"
  create_alias = true
  zone_id = "ROUTE53_HOSTED_ZONE_ID"
}

# Resource Tags
tags = {
  Environment = "staging"
  Project = "enrollment-system"
  ManagedBy = "terraform"
  Owner = "platform-team"
  CostCenter = "staging-ops"
  SecurityZone = "restricted"
  DataClassification = "confidential"
  BackupSchedule = "daily"
  MaintenanceWindow = "sun:04:00-sun:06:00"
  ComplianceScope = "internal"
}

# Backup Configuration
backup_retention = 7

# WAF Configuration
waf_config = {
  enabled = true
  ip_rate_limit = 2000
  rule_set = "core-rule-set"
  ip_whitelist = ["OFFICE_IP_RANGES"]
}

# CloudWatch Alarms
alarm_config = {
  cpu_utilization_threshold = 70
  memory_utilization_threshold = 80
  disk_utilization_threshold = 85
  response_time_threshold = 3
  error_rate_threshold = 5
}
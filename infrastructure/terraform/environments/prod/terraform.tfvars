# Core Environment Configuration
environment = "prod"
aws_region = "us-west-2"
project_name = "enrollment-system"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# Monitoring Configuration
enable_monitoring = true
enable_enhanced_monitoring = true
monitoring_interval = 30

# Database Configuration
db_config = {
  instance_class = "db.r6g.xlarge"
  allocated_storage = 500
  max_allocated_storage = 1000
  backup_retention_period = 30
  multi_az = true
  deletion_protection = true
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  storage_encrypted = true
  monitoring_interval = 30
  engine = "postgres"
  engine_version = "14.7"
  storage_type = "gp3"
  parameter_family = "postgres14"
  port = 5432
}

# Auto Scaling Configuration
autoscaling_config = {
  min_capacity = 3
  max_capacity = 12
  target_cpu = 70
  target_memory = 80
  scale_in_cooldown = 300
  scale_out_cooldown = 180
}

# Security Configuration
security_config = {
  enable_encryption = true
  ssl_certificate_arn = "arn:aws:acm:us-west-2:*:certificate/*"
  allowed_cidr_blocks = ["10.0.0.0/8"]
  enable_waf = true
  enable_shield = true
}

# Cache Configuration
elasticache_config = {
  node_type = "cache.r6g.xlarge"
  num_cache_nodes = 3
  engine_version = "7.0"
  port = 6379
}

# DNS Configuration
dns_config = {
  domain_name = "enrollment.example.com"
  create_alias = true
  zone_id = "ZONE_ID"
}

# Monitoring and Logging Configuration
monitoring_config = {
  retention_days = 90
  enable_dashboard = true
  alarm_email = "alerts-prod@example.com"
}

# Resource Tags
tags = {
  Environment = "production"
  Project = "enrollment-system"
  ManagedBy = "terraform"
  BusinessUnit = "education"
  DataClassification = "restricted"
  ComplianceLevel = "high"
  BackupRetention = "30days"
  SecurityZone = "production"
  CostCenter = "enrollment-prod"
  Owner = "platform-team"
  Compliance = "ferpa,gdpr"
  HighAvailability = "true"
  MaintenanceWindow = "sun:03:00-sun:07:00"
  DR = "enabled"
}

# Backup Configuration
backup_retention = 30

# WAF Configuration
waf_config = {
  enabled = true
  ip_rate_limit = 2000
  rule_priority = 100
  block_period = 240
}

# Shield Advanced Configuration
shield_config = {
  enabled = true
  protection_group_aggregation = "SUM"
  protection_group_pattern = "ALL"
}

# Performance and Scaling Configuration
performance_config = {
  enable_performance_insights = true
  performance_insights_retention = 7
  enable_enhanced_monitoring = true
  monitoring_interval = 30
  scaling_target_value = 70
}
# AWS Provider version: ~> 5.0

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier"
  default     = "staging"
  validation {
    condition     = var.environment == "staging"
    error_message = "This is a staging environment configuration"
  }
}

# VPC Configuration
variable "vpc_config" {
  type = object({
    vpc_cidr                 = string
    availability_zones       = list(string)
    public_subnet_cidrs     = list(string)
    private_subnet_cidrs    = list(string)
    enable_nat_gateway      = bool
    single_nat_gateway      = bool
    enable_vpn_gateway      = bool
    enable_flow_logs        = bool
    flow_logs_retention_days = number
  })
  description = "VPC configuration for staging environment"
  default = {
    vpc_cidr              = "10.1.0.0/16"  # Staging VPC CIDR range
    availability_zones    = ["us-west-2a", "us-west-2b"]  # Multi-AZ deployment
    public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]  # Public subnets
    private_subnet_cidrs = ["10.1.3.0/24", "10.1.4.0/24"]  # Private subnets
    enable_nat_gateway   = true  # Enable NAT for private subnet internet access
    single_nat_gateway   = true  # Cost optimization for staging
    enable_vpn_gateway   = false # VPN not required for staging
    enable_flow_logs     = true  # Enable VPC flow logs for security
    flow_logs_retention_days = 30 # 30-day retention for flow logs
  }
}

# RDS Configuration
variable "rds_config" {
  type = object({
    instance_class                          = string
    allocated_storage                       = number
    max_allocated_storage                   = number
    backup_retention_period                 = number
    multi_az                               = bool
    deletion_protection                    = bool
    storage_encrypted                      = bool
    monitoring_interval                    = number
    performance_insights_enabled           = bool
    performance_insights_retention_period  = number
  })
  description = "RDS configuration for staging environment"
  default = {
    instance_class                         = "db.t3.large"  # Fixed capacity for staging
    allocated_storage                      = 100  # Initial storage in GB
    max_allocated_storage                  = 500  # Max storage in GB
    backup_retention_period                = 7    # 7-day backup retention
    multi_az                              = true  # Enable high availability
    deletion_protection                    = true  # Prevent accidental deletion
    storage_encrypted                      = true  # Enable encryption at rest
    monitoring_interval                    = 60   # Enhanced monitoring interval
    performance_insights_enabled           = true  # Enable performance insights
    performance_insights_retention_period  = 7    # 7-day retention for insights
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags for staging environment resources"
  default = {
    Environment         = "staging"
    Project            = "enrollment-system"
    ManagedBy          = "terraform"
    CostCenter         = "pre-production"
    DataClassification = "confidential"
    BackupSchedule     = "daily"
    MaintenanceWindow  = "sun:03:00-sun:04:00"
  }
}

# ECS Configuration
variable "ecs_config" {
  type = object({
    container_insights = bool
    capacity_providers = list(string)
    task_cpu          = number
    task_memory       = number
    min_capacity      = number
    max_capacity      = number
  })
  description = "ECS configuration for staging environment"
  default = {
    container_insights = true
    capacity_providers = ["FARGATE", "FARGATE_SPOT"]
    task_cpu          = 1024  # 1 vCPU
    task_memory       = 2048  # 2GB RAM
    min_capacity      = 2     # Minimum 2 tasks
    max_capacity      = 4     # Maximum 4 tasks for staging
  }
}

# ElastiCache Configuration
variable "elasticache_config" {
  type = object({
    node_type                = string
    num_cache_nodes         = number
    parameter_group_family  = string
    engine_version         = string
    port                   = number
    automatic_failover     = bool
  })
  description = "ElastiCache configuration for staging environment"
  default = {
    node_type               = "cache.t3.medium"  # Fixed size for staging
    num_cache_nodes        = 2                  # Multi-node for HA
    parameter_group_family = "redis6.x"
    engine_version        = "6.x"
    port                  = 6379
    automatic_failover    = true                # Enable automatic failover
  }
}

# Security Configuration
variable "security_config" {
  type = object({
    enable_waf                = bool
    waf_rule_size            = string
    ssl_policy               = string
    enable_shield            = bool
    enable_securityhub       = bool
    enable_guardduty         = bool
  })
  description = "Security configuration for staging environment"
  default = {
    enable_waf           = true
    waf_rule_size       = "Regular"  # Regular WAF rules for staging
    ssl_policy          = "ELBSecurityPolicy-TLS-1-2-2017-01"
    enable_shield       = false      # Shield not required for staging
    enable_securityhub  = true
    enable_guardduty    = true
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  type = object({
    log_retention_days        = number
    enable_detailed_monitoring = bool
    alarm_evaluation_periods  = number
    alarm_datapoints_required = number
  })
  description = "Monitoring configuration for staging environment"
  default = {
    log_retention_days         = 30    # 30-day log retention
    enable_detailed_monitoring = true   # Enable detailed monitoring
    alarm_evaluation_periods   = 3      # Number of periods to evaluate
    alarm_datapoints_required  = 2      # Required datapoints to trigger
  }
}
# AWS Provider version ~> 5.0

variable "vpc_name" {
  type        = string
  description = "Name of the VPC for the enrollment system"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]+$", var.vpc_name))
    error_message = "VPC name must only contain alphanumeric characters, hyphens, and underscores."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network (e.g., 10.0.0.0/16)"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation."
  }

  validation {
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 24
    error_message = "VPC CIDR block must have a prefix length of /24 or larger (e.g., /16, /20)."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for VPC subnet distribution"
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }

  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", az))])
    error_message = "Availability zones must be in the format: region-az (e.g., us-east-1a)."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets, one per availability zone"
  
  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All public subnet CIDR blocks must be in valid IPv4 CIDR notation."
  }

  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : tonumber(split("/", cidr)[1]) >= 24])
    error_message = "Public subnet CIDR blocks must have a prefix length of /24 or smaller."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets, one per availability zone"
  
  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All private subnet CIDR blocks must be in valid IPv4 CIDR notation."
  }

  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : tonumber(split("/", cidr)[1]) >= 24])
    error_message = "Private subnet CIDR blocks must have a prefix length of /24 or smaller."
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway for private subnet internet access. Set to true for production environments."
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use a single NAT Gateway instead of one per AZ to reduce costs in non-production environments"
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all VPC resources for cost allocation and environment identification"
  default     = {}

  validation {
    condition     = contains(keys(var.tags), "Environment")
    error_message = "Tags must include an 'Environment' key for resource identification."
  }

  validation {
    condition     = contains(keys(var.tags), "Project")
    error_message = "Tags must include a 'Project' key for cost allocation."
  }

  validation {
    condition     = alltrue([for k, v in var.tags : can(regex("^[a-zA-Z0-9-_]+$", k)) && can(regex("^[a-zA-Z0-9-_]+$", v))])
    error_message = "Tag keys and values must only contain alphanumeric characters, hyphens, and underscores."
  }
}
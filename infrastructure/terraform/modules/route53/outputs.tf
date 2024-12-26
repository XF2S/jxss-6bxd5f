# Zone ID output for DNS record management
output "zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
  sensitive   = false
}

# Name servers output for domain delegation
output "name_servers" {
  description = "List of name servers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
  sensitive   = false
}

# Health check ID output for DNS failover configuration
output "health_check_id" {
  description = "ID of the Route53 health check"
  value       = aws_route53_health_check.main.id
  sensitive   = false
}

# Domain name output for reference by other modules
output "domain_name" {
  description = "Domain name configured for the enrollment system"
  value       = var.domain_name
  sensitive   = false
}

# Composite output for module integration
output "route53_outputs" {
  description = "Complete set of Route53 configuration outputs for service integration"
  value = {
    zone_id         = aws_route53_zone.main.zone_id
    name_servers    = aws_route53_zone.main.name_servers
    health_check_id = aws_route53_health_check.main.id
    domain_name     = var.domain_name
    dnssec_status   = aws_route53_zone.main.enable_dnssec
  }
  sensitive = false
}

# DNS records output for monitoring and management
output "dns_records" {
  description = "Map of configured DNS records and their types"
  value = {
    primary = {
      name = aws_route53_record.main.name
      type = aws_route53_record.main.type
    }
    www = {
      name = aws_route53_record.www.name
      type = aws_route53_record.www.type
    }
    txt = {
      name = aws_route53_record.txt.name
      type = aws_route53_record.txt.type
    }
    mx = {
      name = aws_route53_record.mx.name
      type = aws_route53_record.mx.type
    }
    caa = {
      name = aws_route53_record.caa.name
      type = aws_route53_record.caa.type
    }
  }
  sensitive = false
}

# Health check status output for monitoring
output "health_check_status" {
  description = "Current status of the Route53 health check"
  value       = aws_route53_health_check.main.status
  sensitive   = false
}
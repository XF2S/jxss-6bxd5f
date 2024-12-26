# CloudFront Distribution ID Output
output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution for DNS and routing configuration"
  value       = aws_cloudfront_distribution.static_assets.id
  sensitive   = false
}

# CloudFront Domain Name Output
output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution for application configuration and DNS setup"
  value       = aws_cloudfront_distribution.static_assets.domain_name
  sensitive   = false
}

# Origin Access Identity Path Output
output "origin_access_identity_path" {
  description = "The path for the CloudFront Origin Access Identity used in S3 bucket policy configuration"
  value       = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
  sensitive   = false
}

# Composite Output for Module Integration
output "cloudfront_distribution_outputs" {
  description = "Complete set of CloudFront distribution attributes for service integration"
  value = {
    id          = aws_cloudfront_distribution.static_assets.id
    domain_name = aws_cloudfront_distribution.static_assets.domain_name
    oai_path    = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    status      = aws_cloudfront_distribution.static_assets.status
    enabled     = aws_cloudfront_distribution.static_assets.enabled
    arn         = aws_cloudfront_distribution.static_assets.arn
  }
  sensitive = false
}
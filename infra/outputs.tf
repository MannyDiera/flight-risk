output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.site.id
}

output "certificate_arn" {
  description = "ARN of the requested ACM certificate, once issued — set this as acm_certificate_arn once validated."
  value       = length(aws_acm_certificate.site) > 0 ? aws_acm_certificate.site[0].arn : null
}

output "certificate_validation_records" {
  description = "DNS records to add at your DNS provider to prove domain ownership for the ACM certificate."
  value = length(aws_acm_certificate.site) > 0 ? [
    for dvo in aws_acm_certificate.site[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ] : []
}

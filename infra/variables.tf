variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "flight-risk"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the custom domain (must be in us-east-1). Leave null to serve on the default *.cloudfront.net domain until the domain is validated."
  type        = string
  default     = null
}

variable "domain_aliases" {
  description = "Custom domain aliases for the CloudFront distribution. Leave empty until the domain is validated."
  type        = list(string)
  default     = ["flight-risk.fyi"]
}

variable "certificate_domains" {
  description = "Domain names to request an ACM certificate for. Decoupled from domain_aliases so the certificate can be requested (and its DNS validation records handed out) before it's attached to CloudFront."
  type        = list(string)
  default     = ["flight-risk.fyi"]
}

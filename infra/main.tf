terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "flight-risk-terraform-state"
    key          = "infra/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "flight-risk"
      Environment = var.environment
      ManagedBy   = "Terraform"
      App         = var.app_name
    }
  }
}

locals {
  app_name       = var.app_name
  s3_bucket_name = "${var.app_name}-${data.aws_caller_identity.current.account_id}"

  # Prefer an explicitly-provided cert (var.acm_certificate_arn) but fall back to the one this
  # config requests itself via certificate_domains, once it's issued — so CloudFront picks up
  # the custom domain automatically without a manual "paste the ARN into a variable" step.
  effective_acm_certificate_arn = var.acm_certificate_arn != null ? var.acm_certificate_arn : try(aws_acm_certificate.site[0].arn, null)
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "site" {
  bucket = local.s3_bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_identity" "site" {
  comment = "OAI for ${local.app_name}"
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.site.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.site.arn}/*"
      }
    ]
  })
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "${local.app_name}-security-headers"
  comment = "Baseline security headers for the flight-risk SPA (Cesium + keyless OpenStreetMap tiles)"

  security_headers_config {
    content_security_policy {
      # No Cesium ion origins needed — terrain/imagery are keyless (ellipsoid terrain + OSM tiles).
      # blob: is required in script-src (not just worker-src) — Cesium loads some of its internals
      # via blob: URLs in a way browsers evaluate against script-src-elem, not just worker-src.
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self' https://tile.openstreetmap.org; font-src 'self' data:;"
      override                = true
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  origin {
    domain_name = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id   = "S3Origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.site.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = var.domain_aliases

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                    = 0
    default_ttl                = 3600
    max_ttl                    = 86400
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
  }

  # index.html — no caching, so deploys go live immediately
  ordered_cache_behavior {
    path_pattern     = "index.html"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                    = 0
    default_ttl                = 0
    max_ttl                    = 0
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
  }

  # Accident data — re-fetched only when the data files themselves change (deploy invalidates).
  ordered_cache_behavior {
    path_pattern     = "data/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                    = 0
    default_ttl                = 86400
    max_ttl                    = 604800
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.effective_acm_certificate_arn == null
    acm_certificate_arn            = local.effective_acm_certificate_arn
    ssl_support_method             = local.effective_acm_certificate_arn == null ? null : "sni-only"
    minimum_protocol_version       = local.effective_acm_certificate_arn == null ? null : "TLSv1.2_2021"
  }
}

# Requested independently of domain_aliases/acm_certificate_arn so the certificate (and its DNS
# validation records) can exist before the domain is actually attached to CloudFront — avoids a
# chicken-and-egg apply where CloudFront needs a validated cert that doesn't exist yet.
resource "aws_acm_certificate" "site" {
  count = length(var.certificate_domains) > 0 ? 1 : 0

  domain_name               = var.certificate_domains[0]
  subject_alternative_names = slice(var.certificate_domains, 1, length(var.certificate_domains))
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

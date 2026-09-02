provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "Payment-Soundbox"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Saktisuman-Panda"
    }
  }
}

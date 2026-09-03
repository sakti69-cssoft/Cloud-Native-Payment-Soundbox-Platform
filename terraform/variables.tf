variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "environment" {
  type    = string
  default = "portfolio-demo"
}
variable "instance_type" {
  type    = string
  default = "t3.small"
}
variable "root_volume_size" {
  type    = number
  default = 25
  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 60
    error_message = "Root volume must be 20-60 GiB."
  }
}
variable "repository_url" {
  type    = string
  default = "https://github.com/sakti69-cssoft/Cloud-Native-Payment-Soundbox-Platform.git"
}
variable "repository_ref" {
  type        = string
  description = "Exact reviewed 40-character Git commit SHA deployed by bootstrap."
  validation {
    condition     = can(regex("^[0-9a-fA-F]{40}$", var.repository_ref))
    error_message = "repository_ref must be an exact 40-character Git commit SHA."
  }
}
variable "ssh_cidr" {
  type     = string
  default  = null
  nullable = true
  validation {
    condition     = var.ssh_cidr == null ? true : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/32$", var.ssh_cidr)) && can(cidrhost(var.ssh_cidr, 0))
    error_message = "SSH must be a valid single IPv4 /32 or null."
  }
}
variable "key_name" {
  type     = string
  default  = null
  nullable = true
}

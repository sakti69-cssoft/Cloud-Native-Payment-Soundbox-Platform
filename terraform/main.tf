module "networking" {
  source = "./modules/networking"
  name   = "soundbox-${var.environment}"
}
module "security" {
  source             = "./modules/security"
  vpc_id             = module.networking.vpc_id
  ssh_cidr           = var.ssh_cidr
  https_egress_cidrs = var.https_egress_cidrs
}
module "iam" {
  source = "./modules/iam"
  name   = "soundbox-${var.environment}"
}
module "compute" {
  source            = "./modules/compute"
  name              = "soundbox-${var.environment}"
  subnet_id         = module.networking.public_subnet_id
  security_group_id = module.security.security_group_id
  instance_profile  = module.iam.instance_profile
  instance_type     = var.instance_type
  root_volume_size  = var.root_volume_size
  key_name          = var.key_name
  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    repository_url = var.repository_url
    repository_ref = var.repository_ref
  })
}

# ── Провайдер Yandex Cloud ───────────────────────────

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.100"
    }
  }
}

provider "yandex" {
  token     = var.yc_token
  cloud_id  = var.yc_cloud_id
  folder_id = var.yc_folder_id
  zone      = var.yc_zone
}

# ── Сеть (используем существующую default) ───────────

data "yandex_vpc_network" "default" {
  name = "default"
}

data "yandex_vpc_subnet" "main" {
  name = "default-ru-central1-a"
}

# ── Сервисный аккаунт ────────────────────────────────

resource "yandex_iam_service_account" "deployer" {
  name        = "${var.project_name}-deployer"
  description = "SA для деплоя контейнеров и доступа к Lockbox"
}

resource "yandex_resourcemanager_folder_iam_member" "deployer_editor" {
  folder_id = var.yc_folder_id
  role      = "editor"
  member    = "serviceAccount:${yandex_iam_service_account.deployer.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "deployer_lockbox" {
  folder_id = var.yc_folder_id
  role      = "lockbox.payloadViewer"
  member    = "serviceAccount:${yandex_iam_service_account.deployer.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "deployer_container_puller" {
  folder_id = var.yc_folder_id
  role      = "container-registry.images.puller"
  member    = "serviceAccount:${yandex_iam_service_account.deployer.id}"
}

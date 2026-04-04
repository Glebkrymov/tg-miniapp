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

# ── Сеть ─────────────────────────────────────────────

resource "yandex_vpc_network" "main" {
  name = "${var.project_name}-network"
}

resource "yandex_vpc_subnet" "main" {
  name           = "${var.project_name}-subnet-a"
  zone           = var.yc_zone
  network_id     = yandex_vpc_network.main.id
  v4_cidr_blocks = ["10.1.0.0/24"]
}

resource "yandex_vpc_subnet" "b" {
  name           = "${var.project_name}-subnet-b"
  zone           = "ru-central1-b"
  network_id     = yandex_vpc_network.main.id
  v4_cidr_blocks = ["10.2.0.0/24"]
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

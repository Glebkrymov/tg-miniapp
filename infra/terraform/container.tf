# ── Container Registry ────────────────────────────────

resource "yandex_container_registry" "tgapp" {
  name      = "${var.project_name}-registry"
  folder_id = var.yc_folder_id
}

# ── Serverless Container (Backend) ───────────────────

resource "yandex_serverless_container" "backend" {
  name               = "${var.project_name}-backend"
  memory             = var.container_memory
  cores              = var.container_cores
  execution_timeout  = "30s"
  concurrency        = var.container_concurrency
  service_account_id = yandex_iam_service_account.deployer.id

  image {
    url = "cr.yandex/${yandex_container_registry.tgapp.id}/backend:latest"
  }

  # Секреты из Lockbox
  secrets {
    id                   = yandex_lockbox_secret.tgapp.id
    version_id           = yandex_lockbox_secret_version.tgapp.id
    key                  = "BOT_TOKEN"
    environment_variable = "BOT_TOKEN"
  }

  secrets {
    id                   = yandex_lockbox_secret.tgapp.id
    version_id           = yandex_lockbox_secret_version.tgapp.id
    key                  = "POYO_API_KEY"
    environment_variable = "POYO_API_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.tgapp.id
    version_id           = yandex_lockbox_secret_version.tgapp.id
    key                  = "DATABASE_URL"
    environment_variable = "DATABASE_URL"
  }

  secrets {
    id                   = yandex_lockbox_secret.tgapp.id
    version_id           = yandex_lockbox_secret_version.tgapp.id
    key                  = "REDIS_URL"
    environment_variable = "REDIS_URL"
  }

  secrets {
    id                   = yandex_lockbox_secret.tgapp.id
    version_id           = yandex_lockbox_secret_version.tgapp.id
    key                  = "JWT_SECRET"
    environment_variable = "JWT_SECRET"
  }

  # Обычные переменные окружения
  provision_policy {
    min_instances = 1
  }
}

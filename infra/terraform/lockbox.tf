# ── Lockbox: секреты приложения ───────────────────────

resource "yandex_lockbox_secret" "tgapp" {
  name        = "${var.project_name}-secrets"
  description = "Секреты для TG Mini App backend"
  folder_id   = var.yc_folder_id
}

resource "yandex_lockbox_secret_version" "tgapp" {
  secret_id = yandex_lockbox_secret.tgapp.id

  entries {
    key        = "BOT_TOKEN"
    text_value = var.bot_token
  }

  entries {
    key        = "POYO_API_KEY"
    text_value = var.poyo_api_key
  }

  entries {
    key = "DATABASE_URL"
    text_value = "postgresql://${yandex_mdb_postgresql_user.tgapp.name}:${var.pg_password}@c-${yandex_mdb_postgresql_cluster.tgapp.id}.rw.mdb.yandexcloud.net:6432/tgapp?ssl=true"
  }

  entries {
    key = "REDIS_URL"
    text_value = "rediss://:${var.valkey_password}@c-${yandex_mdb_redis_cluster.tgapp.id}.rw.mdb.yandexcloud.net:6380/0"
  }

  entries {
    key        = "JWT_SECRET"
    text_value = var.jwt_secret
  }

  entries {
    key        = "WEBAPP_URL"
    text_value = var.webapp_url
  }

  entries {
    key        = "POYO_BASE_URL"
    text_value = var.poyo_base_url
  }

  entries {
    key        = "ALERT_BOT_TOKEN"
    text_value = var.alert_bot_token
  }

  entries {
    key        = "ALERT_CHAT_ID"
    text_value = var.alert_chat_id
  }
}

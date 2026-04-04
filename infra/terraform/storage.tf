# ── Object Storage: фронтенд (статика) ───────────────

resource "yandex_storage_bucket" "frontend" {
  bucket    = "${var.project_name}-frontend"
  folder_id = var.yc_folder_id

  # Публичный доступ для статики
  anonymous_access_flags {
    read        = true
    list        = false
    config_read = false
  }

  # Настройки static website hosting
  website {
    index_document = "index.html"
    error_document = "index.html"   # SPA fallback
  }

  # CORS для API запросов
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

# ── Переменные Terraform ─────────────────────────────

variable "yc_token" {
  description = "IAM или OAuth токен для Yandex Cloud"
  type        = string
  sensitive   = true
}

variable "yc_cloud_id" {
  description = "ID облака Yandex Cloud"
  type        = string
}

variable "yc_folder_id" {
  description = "ID каталога (folder) в Yandex Cloud"
  type        = string
}

variable "yc_zone" {
  description = "Зона доступности"
  type        = string
  default     = "ru-central1-a"
}

variable "project_name" {
  description = "Имя проекта (используется в именах ресурсов)"
  type        = string
  default     = "tgapp"
}

# ── Секреты приложения ──────────────────────────────

variable "bot_token" {
  description = "Telegram Bot Token"
  type        = string
  sensitive   = true
}

variable "webapp_url" {
  description = "URL фронтенда Mini App"
  type        = string
}

variable "poyo_api_key" {
  description = "API ключ PoYo.ai"
  type        = string
  sensitive   = true
}

variable "poyo_base_url" {
  description = "Базовый URL PoYo API"
  type        = string
  default     = "https://api.poyo.ai"
}

variable "jwt_secret" {
  description = "Секрет для JWT (если используется)"
  type        = string
  sensitive   = true
}

variable "alert_bot_token" {
  description = "Токен бота для алертов"
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_chat_id" {
  description = "Chat ID для алертов"
  type        = string
  default     = ""
}

# ── Параметры инфраструктуры ────────────────────────

variable "pg_password" {
  description = "Пароль пользователя PostgreSQL"
  type        = string
  sensitive   = true
}

variable "pg_disk_size" {
  description = "Размер диска PostgreSQL (ГБ)"
  type        = number
  default     = 10
}

variable "valkey_password" {
  description = "Пароль Valkey (Redis)"
  type        = string
  sensitive   = true
}

variable "container_memory" {
  description = "Память для Serverless Container (МБ)"
  type        = number
  default     = 512
}

variable "container_cores" {
  description = "Кол-во ядер для Serverless Container"
  type        = number
  default     = 1
}

variable "container_concurrency" {
  description = "Макс. кол-во одновременных запросов к контейнеру"
  type        = number
  default     = 8
}

variable "domain" {
  description = "Домен для приложения (опционально)"
  type        = string
  default     = ""
}

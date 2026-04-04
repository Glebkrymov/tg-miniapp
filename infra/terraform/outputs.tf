# ── Outputs ───────────────────────────────────────────

output "container_url" {
  description = "URL Serverless Container (backend)"
  value       = yandex_serverless_container.backend.url
}

output "gateway_url" {
  description = "URL API Gateway (единая точка входа)"
  value       = "https://${yandex_api_gateway.tgapp.domain}"
}

output "frontend_bucket" {
  description = "Имя бакета для фронтенда"
  value       = yandex_storage_bucket.frontend.bucket
}

output "registry_id" {
  description = "ID Container Registry"
  value       = yandex_container_registry.tgapp.id
}

output "postgres_host" {
  description = "Хост PostgreSQL (для подключения)"
  value       = "c-${yandex_mdb_postgresql_cluster.tgapp.id}.rw.mdb.yandexcloud.net"
}

output "valkey_host" {
  description = "Хост Valkey (Redis)"
  value       = "c-${yandex_mdb_redis_cluster.tgapp.id}.rw.mdb.yandexcloud.net"
}

output "service_account_id" {
  description = "ID сервисного аккаунта"
  value       = yandex_iam_service_account.deployer.id
}

output "lockbox_secret_id" {
  description = "ID секрета Lockbox"
  value       = yandex_lockbox_secret.tgapp.id
}

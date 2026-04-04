# ── API Gateway ───────────────────────────────────────
# Единая точка входа для фронтенда и бэкенда

resource "yandex_api_gateway" "tgapp" {
  name        = "${var.project_name}-gateway"
  description = "API Gateway для TG Mini App"

  spec = <<-EOT
    openapi: 3.0.0
    info:
      title: ${var.project_name} API Gateway
      version: 1.0.0
    paths:
      # ── Backend API и webhooks ─────────────────────
      /api/{path+}:
        x-yc-apigateway-any-method:
          x-yc-apigateway-integration:
            type: serverless_containers
            container_id: ${yandex_serverless_container.backend.id}
            service_account_id: ${yandex_iam_service_account.deployer.id}
          parameters:
            - name: path
              in: path
              required: true
              schema:
                type: string

      /webhook/{path+}:
        x-yc-apigateway-any-method:
          x-yc-apigateway-integration:
            type: serverless_containers
            container_id: ${yandex_serverless_container.backend.id}
            service_account_id: ${yandex_iam_service_account.deployer.id}
          parameters:
            - name: path
              in: path
              required: true
              schema:
                type: string

      /health:
        get:
          x-yc-apigateway-integration:
            type: serverless_containers
            container_id: ${yandex_serverless_container.backend.id}
            service_account_id: ${yandex_iam_service_account.deployer.id}

      # ── Frontend (статика из Object Storage) ───────
      /:
        get:
          x-yc-apigateway-integration:
            type: object_storage
            bucket: ${yandex_storage_bucket.frontend.bucket}
            object: index.html
            service_account_id: ${yandex_iam_service_account.deployer.id}

      /{file+}:
        get:
          x-yc-apigateway-integration:
            type: object_storage
            bucket: ${yandex_storage_bucket.frontend.bucket}
            object: '{file}'
            service_account_id: ${yandex_iam_service_account.deployer.id}
          parameters:
            - name: file
              in: path
              required: true
              schema:
                type: string
  EOT
}

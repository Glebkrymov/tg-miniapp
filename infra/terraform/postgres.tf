# ── Managed PostgreSQL 16 ─────────────────────────────

resource "yandex_mdb_postgresql_cluster" "tgapp" {
  name        = "${var.project_name}-postgres"
  environment = "PRODUCTION"
  network_id  = data.yandex_vpc_network.default.id

  config {
    version = "16"

    resources {
      resource_preset_id = "s2.micro"      # 2 vCPU, 8 GB RAM
      disk_type_id       = "network-ssd"
      disk_size          = var.pg_disk_size
    }

    # Настройки PostgreSQL
    postgresql_config = {
      max_connections                = 100
      default_transaction_isolation  = "TRANSACTION_ISOLATION_READ_COMMITTED"
      log_min_duration_statement     = 500   # логировать запросы > 500мс
    }
  }

  host {
    zone      = var.yc_zone
    subnet_id = data.yandex_vpc_subnet.main.id
  }
}

# ── База данных ──────────────────────────────────────

resource "yandex_mdb_postgresql_database" "tgapp" {
  cluster_id = yandex_mdb_postgresql_cluster.tgapp.id
  name       = "tgapp"
  owner      = yandex_mdb_postgresql_user.tgapp.name

  extension {
    name = "uuid-ossp"
  }
}

# ── Пользователь БД ─────────────────────────────────

resource "yandex_mdb_postgresql_user" "tgapp" {
  cluster_id = yandex_mdb_postgresql_cluster.tgapp.id
  name       = "tgapp"
  password   = var.pg_password
}

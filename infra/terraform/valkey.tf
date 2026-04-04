# ── Managed Valkey (Redis-совместимый) ────────────────

resource "yandex_mdb_redis_cluster" "tgapp" {
  name        = "${var.project_name}-valkey"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.main.id

  config {
    version  = "7.2"
    password = var.valkey_password

    maxmemory_policy = "allkeys-lru"
  }

  resources {
    resource_preset_id = "hm3-c2-m8"   # 2 vCPU, 8 GB RAM
    disk_type_id       = "network-ssd"
    disk_size          = 16
  }

  host {
    zone      = var.yc_zone
    subnet_id = yandex_vpc_subnet.main.id
  }
}

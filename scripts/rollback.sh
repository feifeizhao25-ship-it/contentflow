#!/usr/bin/env bash
# 分发侠ContentFlow — 生产回滚脚本（docker compose 环境）
#
# 用法:
#   bash scripts/rollback.sh [VERSION]
#
#   VERSION   目标镜像 tag，缺省 "previous"（需确保该 tag 已推送到镜像仓库或存在于本地）。
#
# 环境变量:
#   COMPOSE_FILE       compose 文件路径（默认 runtime/docker-compose.production.yml）
#   RUN_DB_DOWNGRADE   =1 时回滚后执行数据库回退（默认 0，不执行）。
#                      注意：Prisma migrate 无官方 downgrade，需提供 DB_DOWNGRADE_CMD。
#   DB_DOWNGRADE_CMD   在 api 容器内执行的回退命令（RUN_DB_DOWNGRADE=1 时必填）
#   HEALTH_URL         外部健康检查 URL；缺省在 api 容器内检查 http://127.0.0.1:4000/health
#
# 健康检查失败时退出非零。
set -euo pipefail

VERSION="${1:-${VERSION:-previous}}"
COMPOSE_FILE="${COMPOSE_FILE:-runtime/docker-compose.production.yml}"
RUN_DB_DOWNGRADE="${RUN_DB_DOWNGRADE:-0}"
DB_DOWNGRADE_CMD="${DB_DOWNGRADE_CMD:-}"
HEALTH_URL="${HEALTH_URL:-}"
SERVICES="api web-cn web-int"

cd "$(dirname "$0")/.."

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

echo "[rollback] target version: $VERSION (compose: $COMPOSE_FILE)"
export IMAGE_TAG="$VERSION"

# 拉取指定 tag（失败则退回本地已有镜像）
compose pull $SERVICES || echo "[rollback] WARN: pull 失败，尝试使用本地镜像"
compose up -d $SERVICES

# 可选：数据库回退
if [ "$RUN_DB_DOWNGRADE" = "1" ]; then
  if [ -z "$DB_DOWNGRADE_CMD" ]; then
    echo "[rollback] ERROR: RUN_DB_DOWNGRADE=1 但未提供 DB_DOWNGRADE_CMD（Prisma 无内建 downgrade）" >&2
    exit 1
  fi
  echo "[rollback] db downgrade: $DB_DOWNGRADE_CMD"
  compose exec -T api sh -c "$DB_DOWNGRADE_CMD"
fi

# 健康检查（最多等 60s）
ok=0
for _ in $(seq 1 12); do
  if [ -n "$HEALTH_URL" ]; then
    curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1 && ok=1 && break
  else
    compose exec -T api wget -qO- http://127.0.0.1:4000/health >/dev/null 2>&1 && ok=1 && break
  fi
  sleep 5
done

if [ "$ok" != "1" ]; then
  echo "[rollback] ERROR: 健康检查失败" >&2
  exit 1
fi
echo "ROLLBACK_OK version=$VERSION"

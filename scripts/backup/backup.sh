#!/usr/bin/env bash
# 分发侠ContentFlow — PostgreSQL 每日备份脚本
#
# 用法:
#   DATABASE_URL=postgresql://contentflow:pass@host:5432/contentflow bash scripts/backup/backup.sh [备份目录]
#
# 行为:
#   1. pg_dump -Fc -Z6 导出 custom 格式备份 + sha256 校验和
#   2. pg_restore --list 自动校验备份完整性（失败退出非零）
#   3. 可选异地（Cloudflare R2 / S3）上传：设置 R2_REMOTE 且检测到 rclone 或 aws s3 才执行
#      - rclone:  R2_REMOTE="r2:bucket/contentflow"（异地保留 30 天自动清理）
#      - aws s3:  R2_REMOTE="s3://bucket/contentflow"（30 天保留请在桶生命周期规则配置）
#   4. 本地保留 RETENTION_DAYS 天（默认 7）
#   5. 失败时若 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 存在则发 Telegram 告警
#   6. 成功输出一行机器可读状态: BACKUP_OK file=... bytes=... sha256=... remote=...
#
# 建议 cron: 每日 03:47 执行（与新能源智库 03:17 错开）。
set -euo pipefail

BACKUP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
R2_REMOTE="${R2_REMOTE:-}"
TS="$(date +%Y%m%d_%H%M%S)"

notify_failure() {
  local msg="$1"
  echo "ERROR: $msg" >&2
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=[contentflow-backup] FAILED $(date -u +%Y-%m-%dT%H:%M:%SZ): ${msg}" \
      >/dev/null 2>&1 || true
  fi
}
trap 'notify_failure "backup failed at line ${LINENO}"' ERR

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL 未设置（postgresql://user:pass@host:5432/contentflow）" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/contentflow_${TS}.dump"

# 1. 导出
pg_dump "$DATABASE_URL" --format=custom --compress=6 --file="$OUT"

# 2. 完整性校验（失败则经 trap 告警并非零退出）
pg_restore --list "$OUT" > /dev/null

# 3. 校验和
if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$OUT" | awk '{print $1}')"
else
  SHA256="$(shasum -a 256 "$OUT" | awk '{print $1}')"
fi
echo "$SHA256  $OUT" > "$OUT.sha256"

# 4. 可选异地上传（R2/S3）
REMOTE_STATUS="skipped"
if [ -z "$R2_REMOTE" ]; then
  echo "hint: 未设置 R2_REMOTE，跳过异地上传"
elif command -v rclone >/dev/null 2>&1; then
  rclone copy "$OUT" "$R2_REMOTE/"
  rclone copy "$OUT.sha256" "$R2_REMOTE/"
  rclone delete --min-age "${REMOTE_RETENTION_DAYS}d" "$R2_REMOTE" || true
  REMOTE_STATUS="uploaded:rclone"
elif command -v aws >/dev/null 2>&1; then
  aws s3 cp "$OUT" "${R2_REMOTE}/"
  aws s3 cp "$OUT.sha256" "${R2_REMOTE}/"
  echo "hint: aws s3 模式请用桶生命周期规则实现异地 ${REMOTE_RETENTION_DAYS} 天保留"
  REMOTE_STATUS="uploaded:aws"
else
  echo "hint: 已设置 R2_REMOTE 但未检测到 rclone 或 aws，跳过异地上传" >&2
  REMOTE_STATUS="skipped:no-tool"
fi

# 5. 本地保留期清理
find "$BACKUP_DIR" -name "contentflow_*.dump" -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "contentflow_*.dump.sha256" -mtime "+$RETENTION_DAYS" -delete

# 6. 机器可读状态行
BYTES="$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT")"
echo "BACKUP_OK file=$OUT bytes=$BYTES sha256=$SHA256 remote=$REMOTE_STATUS"

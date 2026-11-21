#!/usr/bin/env bash
# 扫描前端产物里的构建占位地址和疑似密钥。只打印命中的文件名和命中的规则名，不打印内容。
# 用法: scan-next-static.sh <static 目录>
# SCAN_ALLOW_INVALID_HOSTS：空格分隔的 .invalid 主机名白名单，只放“只拿来当 URL 解析基准、从不请求”的写法
# （例如 new URL(raw, 'https://placeholder.invalid') 用来判断跳转地址是不是同源）。
set -euo pipefail
dir="${1:?usage: scan-next-static.sh <dir>}"
[ -d "$dir" ] || { echo "目录不存在: $dir" >&2; exit 2; }
count=$(find "$dir" -type f | wc -l)
[ "$count" -gt 0 ] || { echo "产物为空: $dir" >&2; exit 2; }
fail=0
check() {
  local name="$1" pattern="$2" files
  files=$(grep -rlE -- "$pattern" "$dir" || true)
  if [ -n "$files" ]; then
    fail=1
    echo "::error::命中规则 [$name] 的文件（只列文件名）:"
    printf '%s\n' "$files" | sed "s|^$dir/||"
  fi
}
# .invalid 主机名单独处理：列出文件名和主机名（主机名不是机密），白名单里的跳过。
allow=" ${SCAN_ALLOW_INVALID_HOSTS:-} "
invalid_hits=""
while IFS= read -r file; do
  hosts=$(grep -oE '[A-Za-z0-9.-]*[A-Za-z0-9-]\.invalid([^A-Za-z0-9.-]|$)' "$file" | sed -E 's/[^A-Za-z0-9.-]$//' | sort -u)
  bad=""
  for h in $hosts; do
    case "$allow" in *" $h "*) ;; *) bad="$bad $h" ;; esac
  done
  [ -n "$bad" ] && invalid_hits="$invalid_hits${file#$dir/}:$bad"$'\n'
done < <(grep -rlE '[A-Za-z0-9-]\.invalid([^A-Za-z0-9-]|$)' "$dir" || true)
if [ -n "$invalid_hits" ]; then
  fail=1
  echo "::error::产物里有 .invalid 占位地址（文件名: 主机名）:"
  printf '%s' "$invalid_hits"
fi
check private-key-block '-----BEGIN [A-Z ]*PRIVATE KEY-----'
check openai-style-sk-key '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{24,}'
check aws-access-key 'AKIA[0-9A-Z]{16}'
check aliyun-access-key '(^|[^A-Za-z0-9])LTAI[0-9A-Za-z]{12,}'
check github-token 'gh[pousr]_[A-Za-z0-9]{30,}'
check slack-token 'xox[abprs]-[A-Za-z0-9-]{10,}'
check supabase-service-role 'service_role'
if [ "$fail" -ne 0 ]; then
  echo "前端产物里发现占位地址或疑似密钥（共扫描 $count 个文件）。" >&2
  exit 1
fi
echo "已扫描 $count 个文件：没有 .invalid 占位地址，也没有疑似密钥。"

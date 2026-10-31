#!/bin/bash
# usage: start_cf3.sh cn|global PORT DB   (fix2 retest: /workspace/fix2/cf built dist, own postgres DB)
R=$1; PORT=$2; DB=$3
export NODE_ENV=development PORT=$PORT MARKET_REGION=$R REGION=$R
export DATABASE_URL="postgresql://pg@127.0.0.1:5433/$DB?schema=public"
export REDIS_HOST=127.0.0.1 REDIS_PORT=16379 REDIS_PASSWORD= REDIS_DB=$([ "$R" = cn ] && echo 10 || echo 11)
export JWT_SECRET=$(python3 -c "import secrets;print(secrets.token_hex(32))") JWT_REFRESH_SECRET=$(python3 -c "import secrets;print(secrets.token_hex(32))")
export CORS_ORIGIN="*" SMS_PROVIDER=dev SMS_CODE_HMAC_SECRET=$(python3 -c "import secrets;print(secrets.token_hex(16))")
export PAYMENT_CALLBACK_SECRET=$(python3 -c "import secrets;print(secrets.token_hex(16))")
export WEBHOOK_ENCRYPTION_KEY=$(python3 -c "import secrets;print(secrets.token_hex(32))")
export OPENROUTER_API_KEY=local-test-placeholder
export DEEPSEEK_API_KEY=local-test-placeholder QWEN_API_KEY=local-test-placeholder AIGC_PROVIDER_CODE=TEST-HARNESS
cd /workspace/fix2/cf/runtime/api
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema src/database/prisma/schema.prisma > /workspace/ui_full_test/logs/cf3_migrate_$R.log 2>&1
exec node dist/main.js

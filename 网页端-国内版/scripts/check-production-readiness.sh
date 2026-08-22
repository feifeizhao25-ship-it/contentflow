#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

echo "Running ContentFlow production readiness checks..."
python3 "$ROOT/scripts/verify_language_contracts.py"
python3 "$ROOT/scripts/validate_rag_freshness.py" --allow-empty
python3 "$ROOT/网页端-国内版/scripts/verify_production_code.py"
python3 "$ROOT/scripts/verify_runtime_compose.py"

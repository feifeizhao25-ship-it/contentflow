echo "🔍 Running production readiness checks..."

python3 "$ROOT/scripts/verify_production_code.py"
python3 "$ROOT/scripts/verify_helm_production.py"
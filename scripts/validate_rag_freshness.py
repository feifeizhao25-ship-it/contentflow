RAG_CACHE_DIRS = [
    PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_cache",
    PROJECT_ROOT / "data" / "rag_cache",
]
RAG_METADATA_FILE = PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_metadata.json"
def get_cache_timestamp(file_path):
    """Extract timestamp from RAG cache JSON file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        ts = data.get("timestamp")
        if ts:
            if isinstance(ts, (int, float)):
                return datetime.fromtimestamp(ts, tz=timezone.utc)
            # Try parsing ISO format
            for fmt in [
def validate_freshness():
    """Validate all RAG cache files for freshness."""
    metadata = load_metadata()
    results = []

    cache_files = []
    for cache_dir in RAG_CACHE_DIRS:
        if not cache_dir.exists():
            print(f"⚠️  RAG cache directory not found: {cache_dir}", file=sys.stderr)
            continue
        cache_files.extend(cache_dir.glob("*.json"))

    if not cache_files:
        return results
    for cache_file in sorted(cache_files):
        fname = cache_file.name
        meta = meta_map.get(fname, {})
        cache_payload = {}
        try:
            cache_payload = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            cache_payload = {}
        source_url = meta.get("source_url") or cache_payload.get("url") or "unknown"
        source_name = meta.get("source_name", "unknown")
        
        result = {
            "file": str(cache_file.relative_to(PROJECT_ROOT)),
            "cache_dir": str(cache_file.parent.relative_to(PROJECT_ROOT)),
            "source_url": source_url,
            "source_name": source_name,

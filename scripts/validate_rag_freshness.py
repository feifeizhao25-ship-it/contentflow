#!/usr/bin/env python3
"""
RAG Knowledge Base Freshness Validator
======================================
Checks all cached RAG knowledge files for freshness.
Flags data older than 6 months (180 days) as stale.
Outputs a report and optionally triggers refresh.

Usage:
    python3 scripts/validate_rag_freshness.py              # Check and report
    python3 scripts/validate_rag_freshness.py --json        # JSON output
    python3 scripts/validate_rag_freshness.py --auto-refresh # Trigger refresh for stale entries

Author: 分发侠 AI Service
Created: 2026-06-27
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Configuration
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAG_CACHE_DIR = PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_cache"
RAG_METADATA_FILE = PROJECT_ROOT / "services" / "ai-service" / "data" / "rag_metadata.json"

MAX_AGE_DAYS = 180       # 6 months
WARNING_DAYS = 150       # Warn at 5 months
TIMEOUT_SECONDS = 30     # HTTP fetch timeout


def load_metadata():
    """Load RAG metadata file."""
    if not RAG_METADATA_FILE.exists():
        print(f"⚠️  Metadata file not found: {RAG_METADATA_FILE}")
        return None
    with open(RAG_METADATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_file_age_days(file_path):
    """Get age of file in days based on modification time."""
    if not file_path.exists():
        return None
    mtime = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
    now = datetime.now(tz=timezone.utc)
    age = (now - mtime).days
    return age


def get_cache_timestamp(file_path):
    """Extract timestamp from RAG cache JSON file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        ts = data.get("timestamp")
        if ts:
            # Try parsing ISO format
            for fmt in [
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
            ]:
                try:
                    return datetime.strptime(ts, fmt)
                except ValueError:
                    continue
            # Try fromisoformat
            try:
                return datetime.fromisoformat(ts)
            except Exception:
                pass
    except Exception:
        pass
    return None


def validate_freshness():
    """Validate all RAG cache files for freshness."""
    metadata = load_metadata()
    results = []
    
    if not RAG_CACHE_DIR.exists():
        print(f"⚠️  RAG cache directory not found: {RAG_CACHE_DIR}")
        return results
    
    cache_files = list(RAG_CACHE_DIR.glob("*.json"))
    
    # Also check metadata entries
    meta_map = {}
    if metadata and "knowledge_files" in metadata:
        for entry in metadata["knowledge_files"]:
            meta_map[entry["file"]] = entry
    
    for cache_file in sorted(cache_files):
        fname = cache_file.name
        meta = meta_map.get(fname, {})
        
        # Get age from file modification time
        age_days = get_file_age_days(cache_file)
        
        # Try to get more precise timestamp from file content
        cache_ts = get_cache_timestamp(cache_file)
        if cache_ts:
            # Use cache timestamp if available
            if cache_ts.tzinfo is None:
                cache_ts = cache_ts.replace(tzinfo=timezone.utc)
            now = datetime.now(tz=timezone.utc)
            age_days = (now - cache_ts).days
        
        max_age_days = int(meta.get("review_cadence_days", MAX_AGE_DAYS))
        warning_days = max(1, max_age_days - min(30, max_age_days // 5 or 1))

        # Determine status
        if age_days is None:
            status = "unknown"
        elif age_days < 0:
            status = "unknown"
        elif age_days >= max_age_days:
            status = "expired"
        elif age_days >= warning_days:
            status = "warning"
        else:
            status = "fresh"
        
        source_url = meta.get("source_url", "unknown")
        source_name = meta.get("source_name", "unknown")
        
        result = {
            "file": fname,
            "source_url": source_url,
            "source_name": source_name,
            "age_days": age_days,
            "status": status,
            "max_age_days": max_age_days,
            "warning_days": warning_days,
            "last_cached": meta.get("last_cached", "N/A"),
            "expiry_date": meta.get("expiry_date", "N/A"),
            "needs_refresh": status in ("expired", "warning"),
        }
        results.append(result)
    
    return results


def print_report(results, integrity_errors=None):
    """Print human-readable freshness report."""
    print("=" * 70)
    print("📊 RAG Knowledge Base Freshness Report")
    print(f"   Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Policy: Max age = {MAX_AGE_DAYS} days | Warning at {WARNING_DAYS} days")
    print("=" * 70)
    
    if not results:
        print("   No RAG cache files found.")
    if integrity_errors:
        for error in integrity_errors:
            print(f"   🔴 {error}")
    if not results:
        return
    
    fresh = [r for r in results if r["status"] == "fresh"]
    warning = [r for r in results if r["status"] == "warning"]
    expired = [r for r in results if r["status"] == "expired"]
    unknown = [r for r in results if r["status"] == "unknown"]
    
    for r in results:
        icon = {
            "fresh": "✅",
            "warning": "⚠️",
            "expired": "🔴",
            "unknown": "❓",
        }.get(r["status"], "❓")
        
        age_str = f"{r['age_days']} days" if r["age_days"] is not None else "N/A"
        print(f"  {icon} {r['file']}")
        print(f"     Source: {r['source_name']} ({r['source_url']})")
        print(f"     Age: {age_str} | Status: {r['status']}")
        if r["needs_refresh"]:
            print(f"     ⚡ ACTION: Refresh recommended (source policy: {r['max_age_days']} days)")
        print()
    
    # Summary
    print("-" * 70)
    print(f"📊 Summary: {len(fresh)} fresh | {len(warning)} warning | {len(expired)} expired | {len(unknown)} unknown")
    print(f"   Total files: {len(results)}")
    
    if expired:
        print(f"\n🔴 {len(expired)} file(s) have EXPIRED (>{MAX_AGE_DAYS} days old) and need immediate refresh!")
    if warning:
        print(f"⚠️  {len(warning)} file(s) are approaching expiry (>{WARNING_DAYS} days old).")


def output_json(results, integrity_errors=None):
    """Output results as JSON."""
    output = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "policy": {
            "max_age_days": MAX_AGE_DAYS,
            "warning_days": WARNING_DAYS,
        },
        "summary": {
            "total": len(results),
            "fresh": len([r for r in results if r["status"] == "fresh"]),
            "warning": len([r for r in results if r["status"] == "warning"]),
            "expired": len([r for r in results if r["status"] == "expired"]),
            "unknown": len([r for r in results if r["status"] == "unknown"]),
        },
        "integrity_errors": integrity_errors or [],
        "files": results,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Validate RAG knowledge base freshness")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--auto-refresh", action="store_true", help="Trigger refresh for stale entries (not implemented)")
    args = parser.parse_args()
    
    results = validate_freshness()
    metadata = load_metadata()
    integrity_errors = []
    if not metadata or not isinstance(metadata.get("knowledge_files"), list):
        integrity_errors.append("RAG metadata is missing or has no knowledge_files catalog.")
    if not results:
        integrity_errors.append("RAG cache is empty; freshness cannot be treated as healthy.")
    if metadata and isinstance(metadata.get("knowledge_files"), list):
        cached_names = {item["file"] for item in results}
        for entry in metadata["knowledge_files"]:
            name = entry.get("file")
            if not name or name not in cached_names:
                integrity_errors.append(f"Catalog entry has no cache file: {name or '<missing name>'}")
    
    if args.json:
        output_json(results, integrity_errors)
    else:
        print_report(results, integrity_errors)
    
    # Exit code: 1 if any expired, 0 otherwise
    has_expired = any(r["status"] == "expired" for r in results)
    sys.exit(1 if has_expired or integrity_errors else 0)


if __name__ == "__main__":
    main()

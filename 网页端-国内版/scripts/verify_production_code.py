#!/usr/bin/env python3
"""Fail CI when production-facing code can present synthetic results as real."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def require(path: str, text: str) -> None:
    content = (ROOT / path).read_text(encoding="utf-8")
    if text not in content:
        errors.append(f"{path}: missing production guard {text!r}")


def forbid_tree(path: str, patterns: tuple[str, ...]) -> None:
    for file in (ROOT / path).rglob("*"):
        if file.suffix not in {".ts", ".tsx", ".js", ".jsx"} or not file.is_file():
            continue
        content = file.read_text(encoding="utf-8")
        for pattern in patterns:
            if pattern in content:
                errors.append(f"{file.relative_to(ROOT)}: forbidden production UI text {pattern!r}")


require(
    "services/knowledge-service/app/skills/knowledge_management.py",
    "synthetic fallback is disabled in production",
)
require(
    "services/ai-engine/app/vector_store/milvus_client.py",
    "refusing to generate synthetic production embeddings",
)
require(
    "services/ai-engine/app/skills/v31_new_skills.py",
    "No synthetic result was generated.",
)
forbid_tree(
    "web-global/src",
    (
        "realbackend",
        "backendreal",
        'https://docs.example.com/',
        'https://example.com/wp',
        "mock-user-id",
    ),
)

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
#!/usr/bin/env python3
"""Static production gate for authentication, publishing and notification code."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = ROOT.parent
errors: list[str] = []


def content(path: Path) -> str:
    return path.read_text(encoding="utf-8")


checks = {
    REPOSITORY_ROOT / "基础设施/architecture/user-service/src/services/auth.service.ts": (
        ("mock-user-id", False),
        ("jwt.verify", True),
    ),
    REPOSITORY_ROOT / "基础设施/architecture/api-gateway/src/config/configuration.ts": (
        ("requiredInProduction('CORS_ORIGIN'", True),
        ("requiredInProduction('JWT_SECRET'", True),
    ),
    ROOT / "services/distribution-service/internal/adapter/base_adapter.go": (
        ("doMockPublish", False),
    ),
    ROOT / "services/distribution-service/cmd/main.go": (
        ("DISTRIBUTION_STRICT_CREDENTIALS", True),
        ("TOKEN_ENCRYPTION_KEY must be set in production", True),
    ),
    ROOT / "services/notification-service/internal/sender/email.go": (
        ("SMTP not configured in production", True),
    ),
}

for path, expectations in checks.items():
    body = content(path)
    for needle, should_exist in expectations:
        if (needle in body) != should_exist:
            state = "missing" if should_exist else "still present"
            errors.append(f"{path.relative_to(REPOSITORY_ROOT)}: {needle!r} {state}")

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
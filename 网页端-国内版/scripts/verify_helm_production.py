#!/usr/bin/env python3
"""Render the production Helm release and reject unsafe deploy artifacts."""

from pathlib import Path
import subprocess
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
CHART = ROOT / "infra/helm/contentflow"
RELEASE_TAG = "0123456789abcdef0123456789abcdef01234567"

command = [
    "helm", "template", "contentflow", str(CHART),
    "--namespace", "production",
    "--set", "global.environment=production",
    "--set", f"global.imageTag={RELEASE_TAG}",
    "--set", "global.imageRegistry=registry.contentflow.invalid",
    "--set", "postgresql.auth.existingSecret=contentflow-db-credentials",
    "--set", "redis.auth.existingSecret=contentflow-redis-credentials",
    "--set", "appSecrets.existingSecret=contentflow-secrets",
    "--set", "web.enabled=true",
    "--set", f"web.image.tag={RELEASE_TAG}",
    "--set", "web.image.registry=registry.contentflow.invalid",
]
result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
if result.returncode:
    print(result.stderr, file=sys.stderr)
    raise SystemExit("Production Helm gate failed: chart did not render")

documents = [
    document
    for document in yaml.safe_load_all(result.stdout)
    if isinstance(document, dict)
]
errors: list[str] = []
deployments: set[str] = set()

for document in documents:
    kind = document.get("kind")
    name = document.get("metadata", {}).get("name", "<unnamed>")
    if kind == "Secret":
        errors.append(f"embedded Secret object {name}")
    if kind == "Deployment":
        deployments.add(name)

    spec = document.get("spec", {})
    pod_spec = None
    if kind in {"Deployment", "StatefulSet", "DaemonSet", "Job"}:
        pod_spec = spec.get("template", {}).get("spec", {})
    if not pod_spec:
        continue
    for container in pod_spec.get("containers", []) + pod_spec.get("initContainers", []):
        image = container.get("image", "")
        if image.endswith(":latest") or (image and ":" not in image and "@sha256:" not in image):
            errors.append(f"{kind}/{name}: mutable or untagged image {image!r}")

required_deployments = {
    "contentflow-gateway",
    "contentflow-auth-service",
    "contentflow-user-service",
    "contentflow-content-service",
    "contentflow-publish-service",
    "contentflow-ai-service",
    "contentflow-billing-service",
    "contentflow-growth-service",
    "contentflow-data-service",
    "contentflow-file-service",
    "contentflow-notification-service",
    "contentflow-scheduler-service",
    "contentflow-distribution-service",
    "contentflow-cn-web",
    "contentflow-int-web",
}
missing = required_deployments - deployments
if missing:
    errors.append("missing production Deployments: " + ", ".join(sorted(missing)))

if errors:
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(f"Production Helm gate failed: {len(errors)} validation error(s)")

print(f"Production Helm gate passed: {len(documents)} resources, {len(deployments)} deployments")
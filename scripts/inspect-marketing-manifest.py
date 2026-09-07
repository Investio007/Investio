"""Inspect bundler manifest entry shapes (dev helper)."""
from __future__ import annotations

import json
import re
from pathlib import Path

html = Path("marketing/index.html").read_text(encoding="utf-8", errors="replace")
m = re.search(
    r'<script[^>]*type="__bundler/manifest"[^>]*>(.*?)</script>',
    html,
    re.S,
)
manifest = json.loads(m.group(1))
for k, v in manifest.items():
    if not isinstance(v, dict):
        print(k, type(v).__name__)
        continue
    mime = v.get("mime") or v.get("type") or ""
    data = v.get("data") or v.get("base64") or v.get("bytes") or ""
    if isinstance(data, dict):
        data = data.get("data") or data.get("base64") or ""
    print(f"{k[:36]} mime={mime!r} datalen={len(data) if isinstance(data, str) else type(data)}")
    extra = {kk: vv for kk, vv in v.items() if kk not in ("data", "base64", "bytes", "content")}
    if extra:
        print("  extra", extra)

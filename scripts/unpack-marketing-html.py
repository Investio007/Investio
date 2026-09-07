"""Unpack Claude/Cursor HTML bundler export into static files."""
from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "marketing" / "index.html"
OUT = ROOT / "marketing" / "dist"


def extract_script(html: str, script_type: str) -> str | None:
    pat = re.compile(
        rf'<script[^>]*type="{re.escape(script_type)}"[^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )
    m = pat.search(html)
    return m.group(1).strip() if m else None


def main() -> int:
    if not SRC.exists():
        print(f"Missing {SRC}", file=sys.stderr)
        return 1

    html = SRC.read_text(encoding="utf-8", errors="replace")
    manifest_raw = extract_script(html, "__bundler/manifest")
    template_raw = extract_script(html, "__bundler/template")
    if not manifest_raw or not template_raw:
        print("Missing bundler manifest/template", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_raw)
    template = json.loads(template_raw)

    print(
        "manifest entries:",
        len(manifest) if isinstance(manifest, dict) else type(manifest),
    )
    print("template type:", type(template).__name__)

    if isinstance(template, dict):
        print("template keys:", list(template.keys())[:20])
        html_out = (
            template.get("html")
            or template.get("content")
            or template.get("document")
            or template.get("template")
        )
    else:
        html_out = template

    OUT.mkdir(parents=True, exist_ok=True)

    if not isinstance(html_out, str):
        (OUT / "_debug_shape.json").write_text(
            json.dumps(
                {
                    "manifest_type": str(type(manifest)),
                    "manifest_sample": (
                        {
                            k: (
                                list(v.keys())
                                if isinstance(v, dict)
                                else type(v).__name__
                            )
                            for k, v in list(manifest.items())[:3]
                        }
                        if isinstance(manifest, dict)
                        else str(manifest)[:500]
                    ),
                    "template_type": str(type(template)),
                    "template_sample": (
                        list(template.keys())[:30]
                        if isinstance(template, dict)
                        else str(template)[:500]
                    ),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print("Wrote debug file; unexpected shape")
        return 2

    assets_dir = OUT / "assets"
    assets_dir.mkdir(exist_ok=True)
    for old in assets_dir.glob("*"):
        if old.is_file():
            old.unlink()

    replaced = 0
    if isinstance(manifest, dict):
        for key, entry in manifest.items():
            mime = "application/octet-stream"
            data_b64 = None
            ext = "bin"

            if isinstance(entry, str):
                data_b64 = entry
            elif isinstance(entry, dict):
                mime = entry.get("mime") or entry.get("type") or mime
                data_b64 = (
                    entry.get("data")
                    or entry.get("base64")
                    or entry.get("bytes")
                    or entry.get("content")
                )
                if isinstance(data_b64, dict):
                    data_b64 = data_b64.get("data") or data_b64.get("base64")

            if not data_b64 or not isinstance(data_b64, str):
                continue

            if mime.startswith("image/"):
                ext = mime.split("/", 1)[1].split(";")[0] or "png"
                if ext == "jpeg":
                    ext = "jpg"
                if ext == "svg+xml":
                    ext = "svg"
            elif "woff2" in mime:
                ext = "woff2"
            elif "woff" in mime:
                ext = "woff"
            elif "ttf" in mime or "font" in mime:
                ext = "ttf"
            elif mime.startswith("text/css"):
                ext = "css"
            elif "javascript" in mime:
                ext = "js"
            elif mime.startswith("text/html"):
                ext = "html"
            elif "json" in mime:
                ext = "json"

            safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", key)[:80]
            filename = f"{safe}.{ext}"
            path = assets_dir / filename
            try:
                raw = base64.b64decode(data_b64)
            except Exception:
                raw = data_b64.encode("utf-8")
            path.write_bytes(raw)

            rel = f"assets/{filename}"
            if key in html_out:
                html_out = html_out.replace(key, rel)
                replaced += 1
            html_out = html_out.replace(f"blob:{key}", rel)

    if "<html" in html_out.lower() and 'lang="' not in html_out[:200].lower():
        html_out = re.sub(r"<html\b", '<html lang="en"', html_out, count=1, flags=re.I)

    if "viewport" not in html_out.lower():
        html_out = re.sub(
            r"(<head[^>]*>)",
            r'\1\n  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            html_out,
            count=1,
            flags=re.I,
        )

    (OUT / "index.html").write_text(html_out, encoding="utf-8")
    print(f"Wrote {OUT / 'index.html'} ({len(html_out)} chars)")
    print(
        f"Assets written: {len(list(assets_dir.glob('*')))}; placeholders replaced: {replaced}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

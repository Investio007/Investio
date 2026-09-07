"""Polish unpacked marketing/dist for production on crowthza.com."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "marketing" / "dist"
INDEX = DIST / "index.html"
LOGO = "assets/f45ca92e-3f0f-4bf1-bf77-9c7ac5184ca6.png"


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")

    # Bake CTA placeholders so links work even before DC hydrates
    html = html.replace("{{ ctaUrl }}", "https://crowthza.app")
    html = html.replace("{{ ctaLabel }}", "Open the app")

    # Legal pages live on the product app
    html = html.replace("Crowth Legal.dc.html#terms", "https://crowthza.app/legal/terms")
    html = html.replace("Crowth Legal.dc.html#privacy", "https://crowthza.app/legal/privacy")
    html = html.replace("Crowth Legal.dc.html#cookies", "https://crowthza.app/legal/cookies")

    # OG / SEO for marketing domain
    html = html.replace(
        'content="https://crowthza.app"',
        'content="https://crowthza.com"',
        1,
    )
    html = re.sub(
        r'content="art/shot-1\.png"',
        f'content="https://crowthza.com/{LOGO}"',
        html,
        count=1,
    )

    # Move <helmet> metadata into <head> and drop custom tags for cleaner DOM
    helmet = re.search(r"<helmet>(.*?)</helmet>", html, flags=re.DOTALL | re.I)
    if helmet:
        meta = helmet.group(1).strip()
        html = html[: helmet.start()] + html[helmet.end() :]
        html = re.sub(
            r"(<meta name=\"viewport\"[^>]*>)",
            rf"\1\n{meta}\n  <link rel=\"canonical\" href=\"https://crowthza.com/\" />",
            html,
            count=1,
            flags=re.I,
        )
        # Fix accidental escapes if any
        html = html.replace('rel=\\"canonical\\"', 'rel="canonical"')
        html = html.replace('href=\\"https://crowthza.com/\\"', 'href="https://crowthza.com/"')

    # Drop unused Google Fonts preconnect (fonts are self-hosted)
    html = re.sub(
        r'<link rel="preconnect" href="https://fonts\.googleapis\.com"\s*/?>\s*',
        "",
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<link rel="preconnect" href="https://fonts\.gstatic\.com"[^>]*>\s*',
        "",
        html,
        flags=re.I,
    )

    # Soften custom element wrappers that confuse some crawlers (keep content)
    # Leave <x-dc> — required by the Design Components runtime.

    INDEX.write_text(html, encoding="utf-8")

    (DIST / "_headers").write_text(
        "\n".join(
            [
                "/*",
                "  X-Content-Type-Options: nosniff",
                "  Referrer-Policy: strict-origin-when-cross-origin",
                "  X-Frame-Options: DENY",
                "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
                "",
                "/assets/*",
                "  Cache-Control: public, max-age=31536000, immutable",
                "",
                "/index.html",
                "  Cache-Control: public, max-age=0, must-revalidate",
                "",
            ]
        ),
        encoding="utf-8",
    )

    (DIST / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nSitemap: https://crowthza.com/sitemap.xml\n",
        encoding="utf-8",
    )

    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <url>\n"
        "    <loc>https://crowthza.com/</loc>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>1.0</priority>\n"
        "  </url>\n"
        "</urlset>\n",
        encoding="utf-8",
    )

    print(f"Polished {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

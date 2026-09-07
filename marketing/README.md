# Crowth marketing site (`crowthza.com`)

Static marketing landing — separate from the product app on **crowthza.app**.

## Layout

| Path | Role |
|------|------|
| `index.html` | Original Claude/Cursor HTML export (bundled, ~10 MB) |
| `dist/` | Production static site (unpacked + polished) — generated |
| `wrangler.toml` | Cloudflare Worker `crowth-marketing` + custom domains |

## Build

```bash
python scripts/unpack-marketing-html.py
python scripts/polish-marketing-dist.py
```

## Preview locally

```bash
npx --yes serve marketing/dist -p 4173
```

## Deploy

```bash
npm run deploy:marketing
```

Live:

- https://crowthza.com
- https://www.crowthza.com
- https://crowth-marketing.investiodev.workers.dev

CTAs open the product app at https://crowthza.app. Legal links go to `/legal/*` on the app.

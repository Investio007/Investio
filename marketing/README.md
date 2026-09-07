# Crowth marketing site

Static marketing landing for **crowthza.com** (separate from the product app on crowthza.app).

## Source

`index.html` is a self-contained Claude/Cursor HTML export (~10 MB). Open it in a browser — it unpacks embedded assets client-side.

## Local preview

```bash
# from repo root
npx --yes serve marketing -p 4173
```

Then open http://localhost:4173

Or double-click `marketing/index.html` (some browsers restrict `file://` features).

## Deploy target

Planned host: Cloudflare Pages / Worker for **`crowthza.com`** (not the product Worker `crowth` on `crowthza.app`).

See `docs/cloudflare.md`.

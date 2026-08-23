# Cloudflare setup for Crowth

Use Cloudflare for DNS, the web app, and the market/AI API (Workers).

## Recommended domain layout

After you buy/connect a domain in Cloudflare (example: `crowth.co.za`):

| Host | Purpose |
|------|---------|
| `crowth.co.za` | Company / marketing site |
| `www.crowth.co.za` | Redirect → apex or marketing |
| `app.crowth.co.za` | Crowth product (Vite SPA + Worker `/api`) |

Until the domain is ready, Cloudflare gives you a `*.workers.dev` URL (e.g. `crowth.investiodev.workers.dev`).

## Architecture

- **Static assets:** Vite `dist/` via Workers static assets
- **API:** same Worker handles `/api/*` natively:
  - Finnhub → quotes, charts, snapshot, compare, insights
  - Workers AI → `POST /api/ai/chat`
- Railway FastAPI is optional/legacy; not required for Cloudflare hosting

## Deploy

### Dashboard

1. Cloudflare → **Workers & Pages** → project **`crowth`**
2. Connect GitHub `Investio007/Investio`, branch `main`
3. **Build command:** `npm run build`
4. **Deploy command:** `npx wrangler deploy`
5. Deploy

### Local / CLI

```bash
npm run build
npx wrangler login
npx wrangler secret put FINNHUB_API_KEY
npx wrangler deploy
```

### Secrets & bindings (Worker runtime)

| Name | How | Purpose |
|------|-----|---------|
| `FINNHUB_API_KEY` | `wrangler secret put` or dashboard | Live market data |
| `AI` | `[ai] binding = "AI"` in `wrangler.toml` | Workers AI chat |

Verify:

```bash
curl https://crowth.investiodev.workers.dev/api/health
```

Expect JSON with `"status":"ok"` and `market_data.finnhub: true` after the secret is set.

### Build variables (Vite — optional) + Worker secrets (required for auth)

Vite can bake `VITE_*` at build time. Cloudflare Workers Builds often omit them, so Crowth also injects Supabase config from **Worker secrets** into HTML at runtime:

```bash
npx wrangler secret put SUPABASE_URL          # same value as VITE_SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY     # same value as VITE_SUPABASE_ANON_KEY
```

Optional Build variables (Settings → Build) if you want them baked in too:

| Name | Secret? |
|------|---------|
| `VITE_SUPABASE_URL` | no |
| `VITE_SUPABASE_ANON_KEY` | yes |

Without either path, `/auth` shows “Supabase is not connected yet.”

Supabase Auth redirect URLs (synced by `scripts/sync-oauth-to-supabase.mjs`):

- `https://crowth.investiodev.workers.dev/auth/callback`
- `https://crowth.investiodev.workers.dev/auth/reset-password`

### After `app.crowth.co.za` is live

1. Worker → **Custom domains** → add `app.crowth.co.za`
2. Supabase → Auth → URL config: add  
   `https://app.crowth.co.za/auth/callback`  
   `https://app.crowth.co.za/auth/reset-password`
3. Google OAuth consent / branding: use Crowth + `app.crowth.co.za`
4. Appflow Production: set `VITE_AUTH_REDIRECT_URL=https://app.crowth.co.za/auth/callback` (web) or keep mobile localhost redirects for Capacitor

The frontend uses same-origin `/api` on `*.workers.dev` and `*.crowth.*` hosts (see `getMarketApiBaseUrl()`).

## Marketing / company site

Create a **second** Cloudflare project (Pages or Workers) for the marketing site, e.g. project name `crowth-web`, attached to `crowth.co.za`. Keep product code in this repo on `app.crowth.co.za`.

## Do not use

- Classic Pages `_redirects` proxy to an external API origin
- Leaving project name as `investio` — use **`crowth`**

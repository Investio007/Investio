# Cloudflare setup for Crowth

Use Cloudflare for DNS, the web app, and the market/AI API (Workers).

## Live domains

| Host | Purpose | Status |
|------|---------|--------|
| `crowthza.app` | Product (SPA + `/api`) | Live on Worker `crowth` |
| `www.crowthza.app` | Same product Worker | Live |
| `crowth.investiodev.workers.dev` | Fallback / preview | Live |
| Marketing apex (e.g. `crowthza.com`) | Company / marketing site | Source in `marketing/` — deploy separately |

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

Custom domains are declared in `wrangler.toml`:

```toml
[[routes]]
pattern = "crowthza.app"
custom_domain = true

[[routes]]
pattern = "www.crowthza.app"
custom_domain = true
```

### Local / CLI

```bash
npm run build
npx wrangler login
npx wrangler secret put FINNHUB_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

### Secrets & bindings (Worker runtime)

| Name | How | Purpose |
|------|-----|---------|
| `FINNHUB_API_KEY` | `wrangler secret put` | Live market data |
| `SUPABASE_URL` | `wrangler secret put` | Injected into SPA HTML |
| `SUPABASE_ANON_KEY` | `wrangler secret put` | Injected into SPA HTML |
| `AI` | `[ai] binding = "AI"` in `wrangler.toml` | Workers AI chat |

Verify:

```bash
curl https://crowthza.app/api/health
curl https://crowth.investiodev.workers.dev/api/health
```

Expect JSON with `"status":"ok"` and `market_data.finnhub: true`.

### Auth redirects

Supabase Auth redirect URLs (synced by `scripts/sync-oauth-to-supabase.mjs`):

- `https://crowthza.app/auth/callback`
- `https://crowthza.app/auth/reset-password`
- `https://www.crowthza.app/auth/callback`
- `https://www.crowthza.app/auth/reset-password`
- `https://crowth.investiodev.workers.dev/auth/callback`
- `https://crowth.investiodev.workers.dev/auth/reset-password`

After domain changes, run **Actions → Sync OAuth Providers to Supabase**.

The frontend uses same-origin `/api` on `crowthza.app` and `*.workers.dev` (see `getMarketApiBaseUrl()`).

## Marketing / company site

Create a **second** Cloudflare project (Pages or Workers) for the marketing site when you register a marketing apex domain. Keep product code in this repo on `crowthza.app`.

## Do not use

- Classic Pages `_redirects` proxy to an external API origin
- Leaving project name as `investio` — use **`crowth`**

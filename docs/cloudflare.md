# Cloudflare setup for Crowth

Use Cloudflare for DNS + the web app. Keep the FastAPI backend on Railway.

## Recommended domain layout

After you buy/connect a domain in Cloudflare (example: `crowth.co.za`):

| Host | Purpose |
|------|---------|
| `crowth.co.za` | Company / marketing site |
| `www.crowth.co.za` | Redirect → apex or marketing |
| `app.crowth.co.za` | Crowth product (this Vite app) |
| `api.crowth.co.za` *(optional)* | CNAME/proxy to Railway later |

Until the domain is ready, Cloudflare gives you a `*.workers.dev` URL.

## Deploy this app (Workers + static assets)

This repo uses **Workers with static assets** (not classic Pages-only), so `/api/*` can proxy to Railway.

### Dashboard (matches the form you opened)

1. Cloudflare → **Workers & Pages** → Create
2. Connect GitHub repo `Investio007/Investio`, branch `main`
3. **Project name:** `crowth`
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler deploy`
6. Deploy

### Local / CLI

```bash
npm run build
npx wrangler login
npx wrangler deploy
```

### Environment variable

In the Worker → **Settings → Variables**:

| Name | Value |
|------|--------|
| `MARKET_API_ORIGIN` | `https://investio-production.up.railway.app` |

(Update later if you rename the Railway service.)

### After `app.crowth.co.za` is live

1. Worker → **Custom domains** → add `app.crowth.co.za`
2. Supabase → Auth → URL config: add  
   `https://app.crowth.co.za/auth/callback`  
   `https://app.crowth.co.za/auth/reset-password`
3. Railway → set `CORS_ORIGINS=https://app.crowth.co.za`
4. Google OAuth consent / branding: use Crowth + `app.crowth.co.za`
5. Appflow Production: set `VITE_AUTH_REDIRECT_URL=https://app.crowth.co.za/auth/callback` (web) or keep mobile localhost redirects for Capacitor

## Marketing / company site

Create a **second** Cloudflare project (Pages or Workers) for the marketing site, e.g. project name `crowth-web`, attached to `crowth.co.za`. Keep product code in this repo on `app.crowth.co.za`.

## Do not use

- Classic Pages `_redirects` proxy to Railway — Cloudflare cannot proxy **external** origins that way.
- Leaving project name as `investio` — use **`crowth`**.

# Google OAuth consent screen branding

## Free fix (recommended — no Supabase Pro)

Crowth uses **Google Identity Services** on the app origin (`crowthza.app` / `localhost`), then `supabase.auth.signInWithIdToken`.  
The account chooser is tied to **your site**, not `….supabase.co`.

### Google Cloud → Credentials → Web client

**Authorized JavaScript origins** (required):

```text
http://localhost:5173
https://crowthza.app
https://www.crowthza.app
https://crowth.investiodev.workers.dev
```

Keep the existing Supabase callback under **Authorized redirect URIs** for Apple / legacy flows:

```text
https://hqzxlitlibxltvsrqhnj.supabase.co/auth/v1/callback
```

### Branding (optional but good)

[Google Auth Platform → Branding](https://console.cloud.google.com/auth/branding):

- App name: `Crowth`
- Logo: `public/logo.png`
- Home / Privacy / Terms: `https://crowthza.app` (+ `/legal/privacy`, `/legal/terms`)
- Authorized domains: `crowthza.app` (and `supabase.co` if still listed)

### Env

- Local: `VITE_GOOGLE_WEB_CLIENT_ID` in `.env` (Web client ID)
- Cloudflare: `npx wrangler secret put GOOGLE_WEB_CLIENT_ID` (same value; injected into the SPA)

---

## Paid option (Supabase custom domain)

Only needed if you want Auth API URLs on `auth.crowthza.app`. Requires Supabase Pro + custom domain add-on. See [Supabase custom domains](https://supabase.com/docs/guides/platform/custom-domains).

---

## Apple Sign In (optional)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a **Services ID** and **Sign in with Apple** key (`.p8`).
3. Add GitHub secrets: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
4. Run **Sync OAuth Providers to Supabase**.
5. Set `VITE_APPLE_SIGN_IN_ENABLED=true` and redeploy.

## Android / Capacitor OAuth

Native Google Sign-In uses package **`com.crowth.app`**. Create an **Android** OAuth client with that package + signing **SHA-1**.  
`VITE_GOOGLE_WEB_CLIENT_ID` must remain the **Web** client ID.

# Google OAuth consent screen branding

Users see **"Continue to supabase.co"** until you brand the Google OAuth consent screen. This is a one-time Google Cloud Console setup (about 15 minutes).

## Steps

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select the project linked to your OAuth client.
2. Go to **APIs & Services** → **OAuth consent screen**.
3. Set **App name** to `Investio`.
4. Upload **App logo** (`public/logo.png` from this repo).
5. Set **User support email** and **Developer contact email**.
6. Add **App domain** (optional but recommended):
   - Application home page: `https://investio-wheat.vercel.app`
   - Privacy policy: `https://investio-wheat.vercel.app/legal/privacy`
   - Terms of service: `https://investio-wheat.vercel.app/legal/terms`
7. Save and submit for verification if Google prompts (testing mode works for your own test users without full verification).

## OAuth client (already configured)

- **Authorized redirect URI:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
- Credentials sync via **Actions → Sync OAuth Providers to Supabase** (see `.github/oauth-secrets.template`).

## Apple Sign In (optional)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a **Services ID** and **Sign in with Apple** key (`.p8`).
3. Add GitHub secrets: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
4. Run **Sync OAuth Providers to Supabase**.
5. Set `VITE_APPLE_SIGN_IN_ENABLED=true` on Vercel and redeploy.

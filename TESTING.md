# Investio — QA & Testing Checklist

Use this before every release. Designed for **frontend-only** testing when the FastAPI backend is not deployed yet. Mark each item **Pass / Fail / Skip / N/A**.

---

## How to test

| Environment | URL | When to use |
|-------------|-----|-------------|
| **Local** | `http://localhost:5173` (or `5174` if port busy) | Daily dev |
| **Vercel preview** | PR branch URL | Before merging |
| **Production** | `https://investio-wheat.vercel.app` | Before announcing release |

**Devices:** Test at least one **Android Chrome** viewport (375×812) and one desktop browser.

**Tools:** Chrome DevTools → device toolbar, or a real phone.

---

## 1. Smoke test (~5 min)

Run this on every deploy.

- [ ] App loads without white screen or console errors
- [ ] Splash → onboarding → auth flow completes
- [ ] Google sign-in works; lands on **Home** (not stuck on onboarding)
- [ ] Bottom nav: Home, Portfolio, Compare, AI Advisor all open
- [ ] Sign out returns to **Auth**; protected routes redirect when logged out
- [ ] Refresh on `/home` works (no 404) — requires `vercel.json` on Vercel
- [ ] `npm run typecheck` and `npm run build` pass in CI

---

## 2. Authentication & security

| # | Test | Expected | P/F |
|---|------|----------|-----|
| A1 | Open `/home` while logged out | Redirect to `/auth` | |
| A2 | Google OAuth — same browser tab start → finish | Session created; Home loads | |
| A3 | OAuth callback URL | `/auth/callback` in Supabase redirect list | |
| A4 | Sign out from Home | Returns to auth; session cleared | |
| A5 | Demo mode button | **Hidden** on production build (Vercel) | |
| A6 | Demo mode (local `npm run dev` only) | Works; reaches Home | |
| A7 | No secrets in page source | Only `VITE_*` public keys; no Finnhub/Ollama keys | |

---

## 3. Navigation & layout (Android / responsive)

| # | Test | Expected | P/F |
|---|------|----------|-----|
| N1 | Full viewport on phone | No phone mockup frame; edge-to-edge | |
| N2 | Bottom nav not hidden by gesture bar | Safe area padding visible | |
| N3 | Header not under status bar | Content below notch area | |
| N4 | Tap targets (nav, back, primary buttons) | Easy to tap; no mis-taps | |
| N5 | Horizontal stock/country scroll | Swipes smoothly; selected state clear | |
| N6 | Onboarding last slide | Disclaimer + Get Started visible | |
| N7 | Rotate / tall vs short screen | No clipped buttons or double scrollbars | |

---

## 4. Home screen (no backend required for UI)

| # | Test | Expected | P/F |
|---|------|----------|-----|
| H1 | Demo portfolio value displays | Shows balance (e.g. R 25,000) | |
| H2 | Country chips scroll | US, CN, JP, etc. selectable | |
| H3 | Stock chips scroll | Apple, Microsoft, etc. selectable | |
| H4 | Period buttons (1D–1Y) | Selection toggles; UI updates | |
| H5 | Quick actions | Build Portfolio + Compare navigate | |
| H6 | Add funds (+) | Opens add-demo-funds screen | |
| H7 | Live prices / chart | **Skip** until backend deployed | Skip |
| H8 | AI Market Insights list | **Skip** until backend deployed | Skip |

---

## 5. Portfolio builder

| # | Test | Expected | P/F |
|---|------|----------|-----|
| P1 | Create new portfolio | Appears in list with name | |
| P2 | Open portfolio detail | Holdings + config visible | |
| P3 | Search and add company | Holding added; toast shows | |
| P4 | Add duplicate company | Toast: already in portfolio | |
| P5 | Remove holding | Removed from list | |
| P6 | Delete portfolio | Confirm dialog (in-app); portfolio removed | |
| P7 | Multiple portfolios | Switch active; holdings isolated | |
| P8 | Refresh page | Portfolios persist (localStorage) | |
| P9 | Cloud sync (logged in) | **Optional** — data in Supabase after debounce | |

---

## 6. Compare screen

| # | Test | Expected | P/F |
|---|------|----------|-----|
| C1 | Page loads layout | Header, scroll areas, back nav | |
| C2 | Live prices / verdict | **Skip** until backend deployed | Skip |
| C3 | Tap company card | Opens stock analysis screen | |

---

## 7. AI Advisor

| # | Test | Expected | P/F |
|---|------|----------|-----|
| AI1 | Chat UI loads | Messages, input, send button | |
| AI2 | Suggested questions tap | Fills/sends question | |
| AI3 | AI response | **Skip** until backend deployed | Skip |
| AI4 | Keyboard on mobile | Input stays visible when typing | |

---

## 8. Stock analysis & add funds

| # | Test | Expected | P/F |
|---|------|----------|-----|
| S1 | Stock analysis from Compare/Home | Screen opens with asset context | |
| S2 | Back button | Returns to previous screen | |
| S3 | Add demo funds | Balance increases; returns to Home | |

---

## 9. Modals & toasts

| # | Test | Expected | P/F |
|---|------|----------|-----|
| M1 | Add to portfolio (from insights when live) | Picker modal inside app shell | |
| M2 | Delete portfolio confirm | Alert dialog; cancel vs confirm | |
| M3 | Toast after add to portfolio | Visible above bottom nav | |

---

## 10. Production / Vercel

| # | Test | Expected | P/F |
|---|------|----------|-----|
| V1 | `VITE_SUPABASE_URL` set | Auth works on production URL | |
| V2 | `VITE_SUPABASE_ANON_KEY` set | No “Connect Supabase” error | |
| V3 | `vercel.json` SPA rewrite | Direct `/auth`, `/home` URLs work | |
| V4 | HTTPS only | No mixed-content warnings | |
| V5 | Branch protection | PR requires CI pass before merge | |

---

## 11. Backend-dependent (run after API deploy)

Skip section 8 in H7/H8/C2/AI3 until `VITE_MARKET_API_URL` points to a live HTTPS API.

- [ ] Home: live price + chart for selected stock
- [ ] Compare: 8 companies with prices and long-term verdict
- [ ] AI Advisor: response with risk level line
- [ ] AI Market Insights: top 20 list populates
- [ ] Backend CORS includes Vercel domain
- [ ] `/api/health` returns `{ "status": "ok" }`

---

## 12. CI / release gate

Before merging to `main`:

- [ ] **Frontend CI** — typecheck + build
- [ ] **Backend CI** — import + health smoke test
- [ ] **Secrets scan** — gitleaks clean
- [ ] Manual smoke test (section 1) on preview URL

---

## Sign-off template

```
Release: ___________
Tester: ___________
Date: ___________
Environment: Local / Preview / Production
Backend deployed: Yes / No

Smoke (§1):     Pass / Fail
Auth (§2):      Pass / Fail
Layout (§3):    Pass / Fail
Portfolio (§5): Pass / Fail
Production (§10): Pass / Fail

Blockers:
Notes:
```

---

## Known limitations (frontend-only)

- Live quotes, charts, compare scores, AI chat, and insights require the FastAPI backend + `VITE_MARKET_API_URL`.
- Portfolio cloud sync requires Supabase auth + deployed `portfolio_items` RLS schema.
- Google OAuth requires redirect URLs for each environment (localhost + Vercel domain).

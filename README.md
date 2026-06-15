# Investio

Investio is a mobile-first fintech education app for learning how to invest. Users explore live market data, compare companies, build demo portfolios, and chat with an AI assistant — all inside a phone mockup UI.

**Design origin:** [Fintech Mobile App Prototype (Figma)](https://www.figma.com/design/1bz8GTMOZQExoTqyYuBSbw/Fintech-Mobile-App-Prototype)

> **Disclaimer:** Investio is for education and simulation only. It does not hold funds, execute trades, or provide financial advice. All portfolio values are demo data.

---

## Features

### Home (`/home`)
- Demo portfolio value card with simulated daily change
- **Country market browser** — 10 markets (US, China, Japan, India, UK, France, Hong Kong, Canada, Germany, South Korea) with per-country stock lists
- Live price charts (1D / 1W / 1M / 6M / 1Y) via Finnhub with fallbacks
- **AI Market Insights** — top 20 live performers ranked by today's change, with AI score, rating, and prediction
- **Add to Portfolio** from insights with portfolio picker (in-phone modal when multiple portfolios exist)
- Quick links to Build Portfolio and Compare

### Build Portfolio (`/portfolio-builder`)
- Create multiple named portfolios (demo amount, risk level, investment goal)
- Add companies from a searchable catalog (US mega-caps + global stocks from country markets)
- Per-portfolio holdings with remove support
- **Delete portfolio** confirmation dialog (in-phone alert)
- Active portfolio highlighted; data persists in `localStorage` and syncs to Supabase when signed in

### Compare (`/compare`)
- Side-by-side comparison of **8 companies:** Apple, Microsoft, Alphabet, NVIDIA, Amazon, Meta, Tesla, Netflix
- Live prices with auto-refresh (~60s)
- Long-term scores (growth, profit, stability, news mood)
- AI long-term pick with beginner tips
- Horizontally scrollable price and score rows on mobile

### AI Advisor (`/ai-assistant`, `/advisor`)
- Chat UI powered by **Ollama** (cloud or local)
- Plain-language answers with optional risk labels (Low / Moderate / High)
- Suggested starter questions

### Stock Analysis (`/analysis`, `/stock/:symbol`)
- Live quote + chart snapshot
- AI traffic-light analysis (growth, profitability, stability, competition)
- Add to portfolio with picker support

### Auth & onboarding
- Splash → onboarding → auth flow
- Email sign-up / sign-in
- Google OAuth (via Supabase) when configured
- **Continue in demo mode** — skip auth and use local storage
- Cloud sync of demo balance and portfolios when signed in

### Other screens
- **Add demo funds** (`/add-funds`) — increase simulated balance
- **Auth callback** (`/auth/callback`) — OAuth PKCE handler

### App shell
- Bottom navigation: Home, Portfolio, Compare, AI Advisor
- Global toast notifications (add/remove portfolio, funds, etc.)
- Modals and alerts render **inside the phone frame**, not the full browser viewport

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 |
| UI | Radix UI, Lucide icons, Recharts |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Market data | Finnhub (primary), yfinance, Alpha Vantage (fallbacks) |
| AI | Ollama (`gemma3:4b` on Ollama Cloud by default) |
| Auth & cloud | Supabase (profiles, portfolio sync, Google OAuth) |
| CI | GitHub Actions (frontend build/typecheck, backend smoke tests, secrets scan) |

---

## Project structure

```
├── src/app/
│   ├── screens/          # Route screens (Home, Compare, Portfolio, etc.)
│   ├── components/       # UI, MobileNav, PhoneModal, GlobalToast
│   ├── context/          # InvestioContext (portfolios, balance, auth)
│   ├── hooks/            # useMarketData, useAddToPortfolioWithPicker
│   ├── services/         # marketApi, aiApi, supabaseDb
│   ├── data/             # assets, countryMarkets, portfolioCatalog
│   └── types/            # portfolio types & helpers
├── server/
│   └── main.py           # FastAPI market + AI API
├── supabase/             # Supabase schema/migrations
├── .github/workflows/    # CI/CD pipelines
└── .env.example          # Environment variable template
```

---

## Getting started

### Prerequisites
- **Node.js** 20+ (CI uses 24)
- **Python** 3.12
- **npm**

### 1. Install dependencies

```bash
npm install
```

### 2. Python virtual environment (backend)

```bash
cd server
python -m venv venv

# Windows
venv\Scripts\activate
pip install -r requirements.txt

# macOS / Linux
source venv/bin/activate
pip install -r requirements.txt

cd ..
```

### 3. Environment variables

Copy `.env.example` to `.env` in the project root and fill in keys:

| Variable | Required | Purpose |
|----------|----------|---------|
| `FINNHUB_API_KEY` | Recommended | Live quotes (free tier at [finnhub.io](https://finnhub.io/register)) |
| `OLLAMA_API_KEY` | For AI chat | Ollama Cloud key ([ollama.com](https://ollama.com)) |
| `OLLAMA_MODEL` | Optional | Default: `gemma3:4b` |
| `VITE_SUPABASE_URL` | For auth/sync | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For auth/sync | Supabase anon key |
| `VITE_MARKET_API_URL` | Production | `http://localhost:8002` for local prod builds |
| `ALPHA_VANTAGE_KEY` | Optional | Fundamentals / chart fallback |

> Never put secret keys in `VITE_*` variables — those are exposed to the browser. AI and market keys are read by the backend only.

### 4. Run the app

**Frontend + backend together (recommended):**

```bash
npm run dev:all
```

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| API | http://127.0.0.1:8002 |
| Health check | http://127.0.0.1:8002/api/health |

**Frontend only:**

```bash
npm run dev
```

**Backend only:**

```bash
npm run dev:server
```

Vite proxies `/api/*` to port **8002** in development.

### 5. Other scripts

```bash
npm run typecheck    # TypeScript check
npm run build        # Production frontend build
npm run preview      # Preview production build
npm run sync:oauth   # Sync OAuth providers to Supabase (see .github/oauth-secrets.template)
```

---

## API endpoints (backend)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server status, data sources, AI config |
| `GET` | `/api/quote/{symbol}` | Live quote |
| `GET` | `/api/chart/{symbol}/{period}` | Chart data (`1D`–`1Y`) |
| `GET` | `/api/snapshot/{symbol}/{period}` | Quote + chart bundle |
| `GET` | `/api/insights` | Top 20 live performers + AI insights |
| `GET` | `/api/compare` | 8-company compare with long-term scores |
| `GET` | `/api/sentiment/{symbol}` | AI traffic-light analysis |
| `POST` | `/api/ai/chat` | AI assistant chat |
| `GET` | `/api/cache/status` | In-memory cache debug |
| `DELETE` | `/api/cache/clear` | Clear server cache |

---

## Data & persistence

- **Local:** `localStorage` keys `investio_portfolios`, `investio_balance` (works offline / demo mode)
- **Cloud:** Supabase `profiles` + `portfolio_items` when user is signed in
- **Market cache:** In-memory server cache (quotes ~60s, charts ~5m, compare ~60s)

---

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Triggers | Checks |
|----------|----------|--------|
| `frontend-ci.yml` | `src/**`, config changes | `npm run typecheck`, `npm run build` |
| `backend-ci.yml` | All PRs, `server/**` | Import check, health + cache smoke test |
| `secrets-scan.yml` | Push / PR | Gitleaks secret scanning |
| `sync-oauth-providers.yml` | Manual | Push OAuth config to Supabase |

---

## Troubleshooting

**Backend port conflicts (Windows)**  
If the API returns stale or partial data, old Uvicorn processes may still be bound to a port. Stop them and restart:

```powershell
Get-NetTCPConnection -LocalPort 8002 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
npm run dev:all
```

**Finnhub 403 on charts**  
Free Finnhub tier does not include candle data. Charts fall back to synthetic / yfinance / Alpha Vantage.

**yfinance rate limits**  
Heavy local testing can trigger Yahoo rate limits. Wait a few minutes or rely on Finnhub quotes.

**AI not responding**  
Verify `OLLAMA_API_KEY` and `OLLAMA_MODEL` in `.env`. Check `/api/health` → `ai.configured` is `true`.

**Supabase auth**  
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Add redirect URL `http://localhost:5173/auth/callback` in Supabase dashboard.

---

## License

Private / educational prototype. See repository owner for usage terms.

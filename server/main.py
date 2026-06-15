from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
import yfinance as yf
import requests as req_lib
import os
import re
from collections import defaultdict
from dotenv import load_dotenv
import math
import time
import random
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

_SERVER_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SERVER_DIR.parent
load_dotenv(_PROJECT_ROOT / ".env", override=True)
load_dotenv(_SERVER_DIR / ".env", override=True)

# ─── Primary data source: Fincept Terminal (fallback to yfinance) ─────────────
try:
    from fincept_terminal import FinceptClient  # type: ignore

    _fincept_client = FinceptClient()
    FINCEPT_AVAILABLE = True
    print("[Investio] Fincept Terminal loaded successfully")
except Exception as e:
    _fincept_client = None
    FINCEPT_AVAILABLE = False
    print(f"[Investio] Fincept Terminal not available: {e} — falling back to yfinance")

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "").strip()
FINNHUB_BASE = "https://finnhub.io/api/v1"
if FINNHUB_API_KEY:
    print("[Investio] Finnhub API configured — using as primary market data source")
else:
    print("[Investio] FINNHUB_API_KEY not set — using yfinance / Alpha Vantage fallbacks")

ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
AV_BASE = "https://www.alphavantage.co/query"
NEWS_API_BASE = "https://newsapi.org/v2"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip().rstrip("/")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "").strip()
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b").strip()
if OLLAMA_API_KEY and OLLAMA_BASE_URL == "http://localhost:11434":
    OLLAMA_BASE_URL = "https://ollama.com"
if OLLAMA_API_KEY or OLLAMA_BASE_URL != "http://localhost:11434":
    print(f"[Investio] Ollama configured — model={OLLAMA_MODEL}, base={OLLAMA_BASE_URL}")
else:
    print("[Investio] OLLAMA_API_KEY not set — AI assistant will use local Ollama if running")


def get_ollama_settings() -> tuple[str, str, str]:
    """Read Ollama settings from .env so updates apply without stale shell env."""
    file_values: dict[str, str] = {}
    env_path = _PROJECT_ROOT / ".env"
    if env_path.is_file():
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            file_values[key.strip()] = value.strip()

    base = (
        file_values.get("OLLAMA_BASE_URL")
        or os.getenv("OLLAMA_BASE_URL")
        or "http://localhost:11434"
    ).strip().rstrip("/")
    api_key = (file_values.get("OLLAMA_API_KEY") or os.getenv("OLLAMA_API_KEY") or "").strip()
    model = (file_values.get("OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL") or "gemma3:4b").strip()
    if api_key and base == "http://localhost:11434":
        base = "https://ollama.com"
    return base, api_key, model

AI_SYSTEM_PROMPT = """You are Investio's AI investment advisor for South African users.
Answer every question in simple, plain English. Maximum 3 sentences.
Always end your response on a new line with exactly one of these:
Risk Level: Low
Risk Level: Moderate
Risk Level: High
Do not use markdown, bullet points, or formatting of any kind."""

app = FastAPI(title="Investio Market Data API")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "").strip()
AI_RATE_LIMIT = int(os.getenv("AI_RATE_LIMIT", "30"))
AI_RATE_WINDOW = int(os.getenv("AI_RATE_WINDOW", "60"))

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
]
_extra_cors = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ALLOW_ORIGINS = _DEFAULT_CORS_ORIGINS + _extra_cors

_ai_rate_buckets: dict[str, list[float]] = defaultdict(list)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        if ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ─── User-Agent rotation for yfinance fallback ────────────────────────────────

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) "
    "Gecko/20100101 Firefox/125.0",
]


def get_yf_session() -> req_lib.Session:
    session = req_lib.Session()
    session.headers.update(
        {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.5",
            "DNT": "1",
        }
    )
    return session

# ─── Symbol map ──────────────────────────────────────────────────────────────

SYMBOL_MAP = {
    # Existing watchlist assets
    "aitech":    "QQQ",
    "energy":    "XLE",
    "crypto":    "BTC-USD",

    # Existing companies
    "apple":     "AAPL",
    "microsoft": "MSFT",
    "alphabet":  "GOOGL",

    # New popular stocks
    "tesla":     "TSLA",
    "amazon":    "AMZN",
    "nvidia":    "NVDA",
    "meta":      "META",
    "netflix":   "NFLX",
    "samsung":   "005930.KS",
    "naspers":   "NPN.JO",
    "sasol":     "SOL.JO",

    # China
    "alibaba":   "BABA",
    "tencent":   "TCEHY",
    "baidu":     "BIDU",
    "jd":        "JD",
    "nio":       "NIO",

    # Japan
    "toyota":    "TM",
    "sony":      "SONY",
    "nintendo":  "NTDOY",

    # India
    "infosys":   "INFY",
    "hdfc":      "HDB",
    "wipro":     "WIT",

    # United Kingdom
    "bp":        "BP",
    "hsbc":      "HSBC",
    "shell":     "SHEL",
    "astrazeneca": "AZN",

    # France
    "total":     "TTE",
    "sanofi":    "SNY",
    "loreal":    "LRLCY",

    # Hong Kong
    "tencent_hk":  "0700.HK",
    "alibaba_hk":  "9988.HK",
    "hsbc_hk":     "0005.HK",

    # Canada
    "shopify":     "SHOP",
    "royalbank":   "RY",
    "tdbank":      "TD",

    # Germany
    "sap":       "SAP",
    "siemens":   "SIEGY",
    "mercedes":  "MBGYY",

    # South Korea
    "skhynix":   "000660.KS",
    "lg":        "066570.KS",

    # Direct uppercase ticker fallbacks
    "AAPL":      "AAPL",
    "MSFT":      "MSFT",
    "GOOGL":     "GOOGL",
    "TSLA":      "TSLA",
    "QQQ":       "QQQ",
    "XLE":       "XLE",
    "BTC-USD":   "BTC-USD",
    "AMZN":      "AMZN",
    "NVDA":      "NVDA",
    "META":      "META",
    "NFLX":      "NFLX",
}

# All trackable assets for live top-performer rankings (lowercase / underscore ids only)
INSIGHT_ASSET_IDS = [key for key in SYMBOL_MAP if key.lower() == key]
INSIGHT_TOP_N = 20

PERIOD_MAP = {
    "1D": ("1d",  "5m"),
    "1W": ("5d",  "30m"),
    "1M": ("1mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y",  "1wk"),
}

# Fincept uses BTC (not BTC-USD) in many clients
FINCEPT_SYMBOL_MAP = {
    "BTC-USD": "BTC",
}

# Finnhub symbol overrides (exchange-prefixed symbols where needed)
FINNHUB_SYMBOL_MAP = {
    "BTC-USD": "BINANCE:BTCUSDT",
    "BTC": "BINANCE:BTCUSDT",
}

FINNHUB_PERIOD_MAP = {
    "1D": ("5", 5 * 86400),
    "1W": ("60", 8 * 86400),
    "1M": ("D", 35 * 86400),
    "6M": ("D", 190 * 86400),
    "1Y": ("W", 380 * 86400),
}

# ─── TTL config (seconds) ─────────────────────────────────────────────────────

TTL = {
    "quote":     60,
    "chart":     300,
    "compare":   60,
    "insights":  60,
    "sentiment": 300,
}

# ─── Retry config ─────────────────────────────────────────────────────────────

RETRY_MAX_ATTEMPTS = 2
RETRY_BASE_DELAY   = 1.0
BATCH_STAGGER_DELAY = 0.5   # seconds between tickers in batch calls

# Skip Alpha Vantage briefly after failures (free tier is slow / often empty)
_av_disabled_until: float = 0.0


def alpha_vantage_enabled() -> bool:
    return bool(ALPHA_VANTAGE_KEY) and time.time() >= _av_disabled_until


def disable_alpha_vantage_temporarily(seconds: int = 600) -> None:
    global _av_disabled_until
    _av_disabled_until = time.time() + seconds

# ─── In-memory cache ─────────────────────────────────────────────────────────

_cache: dict[str, dict] = {}


def cache_get(key: str, ttl: int) -> tuple[Optional[Any], bool]:
    entry = _cache.get(key)
    if entry is None:
        return None, False
    age = time.time() - entry["fetched_at"]
    return entry["data"], age <= ttl


def cache_set(key: str, data: Any) -> None:
    _cache[key] = {"data": data, "fetched_at": time.time()}


def cache_get_stale(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    return entry["data"] if entry else None


# ─── Retry helper ─────────────────────────────────────────────────────────────

async def with_retry(
    fn,
    max_attempts: int = RETRY_MAX_ATTEMPTS,
    base_delay: float = RETRY_BASE_DELAY,
    timeout: float = 8.0,
):
    last_exc = None
    for attempt in range(max_attempts):
        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, fn),
                timeout=timeout,
            )
            return result
        except asyncio.TimeoutError as exc:
            last_exc = exc
        except Exception as exc:
            last_exc = exc
            if attempt < max_attempts - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(-0.3, 0.3)
                delay = max(0.2, delay)
                await asyncio.sleep(delay)
    raise last_exc


# ─── Helpers ──────────────────────────────────────────────────────────────────

def resolve_ticker(symbol: str) -> str:
    key = symbol.lower().strip()
    if key in SYMBOL_MAP:
        return SYMBOL_MAP[key]
    upper = symbol.upper().strip()
    if re.fullmatch(r"[A-Z0-9.\-^]{1,16}", upper):
        return upper
    raise HTTPException(status_code=400, detail="Invalid or unsupported symbol")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def enforce_rate_limit(request: Request, limit: int = AI_RATE_LIMIT) -> None:
    ip = client_ip(request)
    now = time.time()
    bucket = _ai_rate_buckets[ip]
    _ai_rate_buckets[ip] = [stamp for stamp in bucket if now - stamp < AI_RATE_WINDOW]
    if len(_ai_rate_buckets[ip]) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Try again shortly.")
    _ai_rate_buckets[ip].append(now)


def require_admin(request: Request) -> None:
    if ENVIRONMENT != "production":
        return
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin endpoints are disabled")
    auth_header = request.headers.get("Authorization", "")
    if auth_header != f"Bearer {ADMIN_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def safe_float(val) -> Optional[float]:
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 2)
    except (TypeError, ValueError):
        return None


def _fincept_symbol(ticker_symbol: str) -> str:
    return FINCEPT_SYMBOL_MAP.get(ticker_symbol, ticker_symbol)


def _as_mapping(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    try:
        return vars(obj)  # type: ignore[arg-type]
    except Exception:
        return {}


def _finnhub_symbol(ticker_symbol: str) -> tuple[str, str]:
    """Return (finnhub_symbol, asset_type) where asset_type is stock|crypto."""
    mapped = FINNHUB_SYMBOL_MAP.get(ticker_symbol, ticker_symbol)
    if mapped.startswith("BINANCE:") or mapped.startswith("COINBASE:"):
        return mapped, "crypto"
    if ticker_symbol in ("BTC-USD", "BTC"):
        return "BINANCE:BTCUSDT", "crypto"

    # Yahoo-style suffixes → Finnhub exchange:symbol
    if mapped.endswith(".KS"):
        return f"KRX:{mapped[:-3]}", "stock"
    if mapped.endswith(".JO"):
        return f"JSE:{mapped[:-3]}", "stock"
    if mapped.endswith(".HK"):
        code = mapped[:-3].lstrip("0") or "0"
        return f"HKEX:{code.zfill(4)}", "stock"

    return mapped, "stock"


def finnhub_request(path: str, params: dict) -> dict:
    if not FINNHUB_API_KEY:
        raise RuntimeError("FINNHUB_API_KEY not set")
    response = req_lib.get(
        f"{FINNHUB_BASE}{path}",
        params={**params, "token": FINNHUB_API_KEY},
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and payload.get("error"):
        raise ValueError(str(payload["error"]))
    return payload


def _finnhub_time_label(period: str, ts: int) -> str:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    if period == "1D":
        return dt.strftime("%H:%M")
    if period in ("1W", "1M"):
        return dt.strftime("%d %b")
    return dt.strftime("%b %Y")


def fetch_quote_finnhub(ticker_symbol: str) -> dict:
    sym, asset_type = _finnhub_symbol(ticker_symbol)

    if asset_type == "crypto":
        now = int(time.time())
        candles = finnhub_request(
            "/crypto/candle",
            {
                "symbol": sym,
                "resolution": "D",
                "from": now - 7 * 86400,
                "to": now,
            },
        )
        if candles.get("s") != "ok" or not candles.get("c"):
            raise ValueError(f"Finnhub: no crypto quote for {ticker_symbol}")
        closes = candles["c"]
        price = safe_float(closes[-1])
        prev_close = safe_float(closes[-2]) if len(closes) >= 2 else price
        change = round(price - prev_close, 2) if price and prev_close else None
        change_pct = round((change / prev_close) * 100, 2) if change and prev_close else None
        return {
            "ticker": ticker_symbol,
            "name": "Bitcoin",
            "price": price,
            "prevClose": prev_close,
            "change": change,
            "changePercent": change_pct,
            "changePositive": (change_pct or 0) >= 0,
            "high": safe_float(candles["h"][-1]) if candles.get("h") else None,
            "low": safe_float(candles["l"][-1]) if candles.get("l") else None,
            "volume": int(candles["v"][-1]) if candles.get("v") else None,
            "marketCap": None,
            "currency": "USD",
        }

    quote = finnhub_request("/quote", {"symbol": sym})
    price = safe_float(quote.get("c"))
    if price is None:
        raise ValueError(f"Finnhub: no quote for {ticker_symbol}")

    prev_close = safe_float(quote.get("pc"))
    change = safe_float(quote.get("d"))
    change_pct = safe_float(quote.get("dp"))
    if change is None and prev_close is not None:
        change = round(price - prev_close, 2)
    if change_pct is None and prev_close:
        change_pct = round((change / prev_close) * 100, 2) if change is not None else None

    name = sym
    currency = "USD"
    try:
        profile = finnhub_request("/stock/profile2", {"symbol": sym})
        name = profile.get("name") or profile.get("ticker") or sym
        currency = profile.get("currency") or "USD"
    except Exception:
        pass

    return {
        "ticker": ticker_symbol,
        "name": name,
        "price": price,
        "prevClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "changePositive": (change_pct or 0) >= 0,
        "high": safe_float(quote.get("h")),
        "low": safe_float(quote.get("l")),
        "volume": None,
        "marketCap": None,
        "currency": currency,
    }


def fetch_chart_finnhub(ticker_symbol: str, period: str) -> list[dict]:
    sym, asset_type = _finnhub_symbol(ticker_symbol)
    resolution, lookback = FINNHUB_PERIOD_MAP.get(period, ("D", 35 * 86400))
    now = int(time.time())
    start = now - lookback
    path = "/crypto/candle" if asset_type == "crypto" else "/stock/candle"

    candles = finnhub_request(
        path,
        {"symbol": sym, "resolution": resolution, "from": start, "to": now},
    )
    if candles.get("s") != "ok":
        raise ValueError(f"Finnhub: no chart for {ticker_symbol}/{period}")

    timestamps = candles.get("t") or []
    opens = candles.get("o") or []
    highs = candles.get("h") or []
    lows = candles.get("l") or []
    closes = candles.get("c") or []
    volumes = candles.get("v") or []

    data: list[dict] = []
    for index, ts in enumerate(timestamps):
        close = safe_float(closes[index]) if index < len(closes) else None
        if close is None:
            continue
        data.append(
            {
                "time": _finnhub_time_label(period, ts),
                "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                "open": safe_float(opens[index]) if index < len(opens) else None,
                "high": safe_float(highs[index]) if index < len(highs) else None,
                "low": safe_float(lows[index]) if index < len(lows) else None,
                "close": close,
                "volume": int(volumes[index]) if index < len(volumes) else 0,
            }
        )

    if not data:
        raise ValueError(f"Finnhub: empty chart for {ticker_symbol}/{period}")
    return data


def fetch_quote_fincept(ticker_symbol: str) -> dict:
    """
    Fincept quote normalized to the exact Investio quote dict shape.
    """
    if not FINCEPT_AVAILABLE or _fincept_client is None:
        raise RuntimeError("Fincept Terminal not available")

    sym = _fincept_symbol(ticker_symbol)
    quote = _fincept_client.quote(sym)
    qd = _as_mapping(quote)

    def pick(*keys):
        for k in keys:
            v = qd.get(k)
            if v is not None:
                return v
        for k in keys:
            v = getattr(quote, k, None)
            if v is not None:
                return v
        return None

    price = safe_float(pick("price", "current_price", "currentPrice", "regularMarketPrice"))
    prev_close = safe_float(pick("previous_close", "prev_close", "previousClose", "regularMarketPreviousClose"))

    if price is None:
        raise ValueError(f"Fincept: no price data for {sym}")

    change = round(price - prev_close, 2) if prev_close else None
    change_pct = round((change / prev_close) * 100, 2) if prev_close and change else None

    name = pick("name", "long_name", "longName", "shortName") or ticker_symbol

    return {
        "ticker": ticker_symbol,
        "name": name,
        "price": price,
        "prevClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "changePositive": (change_pct or 0) >= 0,
        "high": safe_float(pick("day_high", "dayHigh", "regularMarketDayHigh")),
        "low": safe_float(pick("day_low", "dayLow", "regularMarketDayLow")),
        "volume": pick("volume", "regularMarketVolume"),
        "marketCap": pick("market_cap", "marketCap"),
        "currency": pick("currency") or "USD",
    }


def fetch_chart_fincept(ticker_symbol: str, period: str) -> list[dict]:
    """
    Fincept history normalized to the exact Investio chart list-of-dicts shape.
    """
    if not FINCEPT_AVAILABLE or _fincept_client is None:
        raise RuntimeError("Fincept Terminal not available")

    sym = _fincept_symbol(ticker_symbol)
    yf_period, yf_interval = PERIOD_MAP.get(period, ("5d", "30m"))
    hist = _fincept_client.history(sym, period=yf_period, interval=yf_interval)

    if hist is None or (hasattr(hist, "empty") and hist.empty):
        raise ValueError(f"Fincept: no chart data for {sym}")

    rows = hist.iterrows() if hasattr(hist, "iterrows") else enumerate(hist)

    data: list[dict] = []
    for timestamp, row in rows:
        if isinstance(row, dict):
            close = safe_float(row.get("close") or row.get("Close"))
            open_val = safe_float(row.get("open") or row.get("Open"))
            high_val = safe_float(row.get("high") or row.get("High"))
            low_val = safe_float(row.get("low") or row.get("Low"))
            vol_val = int(row.get("volume") or row.get("Volume") or 0)
        else:
            try:
                close = safe_float(row.get("Close") if hasattr(row, "get") else getattr(row, "Close", None))
            except Exception:
                close = safe_float(getattr(row, "Close", None) or getattr(row, "close", None))

            try:
                open_val = safe_float(row.get("Open") if hasattr(row, "get") else getattr(row, "Open", None))
                high_val = safe_float(row.get("High") if hasattr(row, "get") else getattr(row, "High", None))
                low_val = safe_float(row.get("Low") if hasattr(row, "get") else getattr(row, "Low", None))
                vol_val = int((row.get("Volume") if hasattr(row, "get") else getattr(row, "Volume", 0)) or 0)
            except Exception:
                open_val = high_val = low_val = None
                vol_val = 0

        if close is None:
            continue

        if period == "1D":
            time_label = timestamp.strftime("%H:%M") if hasattr(timestamp, "strftime") else str(timestamp)[:5]
        elif period in ("1W", "1M"):
            time_label = timestamp.strftime("%d %b") if hasattr(timestamp, "strftime") else str(timestamp)[:10]
        else:
            time_label = timestamp.strftime("%b %Y") if hasattr(timestamp, "strftime") else str(timestamp)[:10]

        ts_iso = timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp)

        data.append(
            {
                "time": time_label,
                "timestamp": ts_iso,
                "open": open_val,
                "high": high_val,
                "low": low_val,
                "close": close,
                "volume": vol_val,
            }
        )

    if not data:
        raise ValueError(f"Fincept: empty chart rows for {sym}")

    return data


def fetch_price_via_download(ticker_symbol: str) -> Optional[float]:
    """
    FIX 2: Use yfinance download() to get the latest close price.
    More reliable than Ticker().info under rate limiting.
    Returns the most recent closing price or None.
    """
    try:
        session = get_yf_session()
        df = yf.download(
            ticker_symbol,
            period="2d",        # last 2 days gives us at least 1 close
            interval="1d",
            progress=False,
            auto_adjust=True,
            session=session,
        )
        if df.empty:
            return None
        # Get the last available close
        close_col = "Close"
        if close_col not in df.columns:
            return None
        last_close = df[close_col].dropna()
        if last_close.empty:
            return None
        return safe_float(last_close.iloc[-1])
    except Exception:
        return None


def fetch_quote_alphavantage(ticker_symbol: str) -> dict:
    """
    Alpha Vantage quote normalized to the exact Investio quote dict shape.
    """
    if not ALPHA_VANTAGE_KEY:
        raise RuntimeError("ALPHA_VANTAGE_KEY not set")

    resp = req_lib.get(
        AV_BASE,
        params={
            "function": "GLOBAL_QUOTE",
            "symbol": ticker_symbol,
            "apikey": ALPHA_VANTAGE_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    gq = data.get("Global Quote", {}) if isinstance(data, dict) else {}
    if not gq or not gq.get("05. price"):
        raise ValueError(f"Alpha Vantage returned no data for {ticker_symbol}")

    price = safe_float(gq.get("05. price"))
    prev_close = safe_float(gq.get("08. previous close"))
    change = safe_float(gq.get("09. change"))

    change_pct_raw = (gq.get("10. change percent") or "0%").replace("%", "")
    change_pct = safe_float(change_pct_raw)

    # AlphaVantage GLOBAL_QUOTE doesn't provide name/marketcap; keep shape stable
    return {
        "ticker": ticker_symbol,
        "name": ticker_symbol,
        "price": price,
        "prevClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "changePositive": (change_pct or 0) >= 0,
        "high": safe_float(gq.get("03. high")),
        "low": safe_float(gq.get("04. low")),
        "volume": gq.get("06. volume"),
        "marketCap": None,
        "currency": "USD",
    }


def fetch_chart_alphavantage(ticker_symbol: str, period: str) -> list[dict]:
    """
    Alpha Vantage OHLCV normalized to the exact Investio chart list-of-dicts shape.
    """
    if not ALPHA_VANTAGE_KEY:
        raise RuntimeError("ALPHA_VANTAGE_KEY not set")

    if period == "1D":
        params = {
            "function": "TIME_SERIES_INTRADAY",
            "symbol": ticker_symbol,
            "interval": "30min",
            "outputsize": "compact",
            "apikey": ALPHA_VANTAGE_KEY,
        }
        time_key = "Time Series (30min)"
    elif period in ("1W", "1M"):
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker_symbol,
            "outputsize": "compact",
            "apikey": ALPHA_VANTAGE_KEY,
        }
        time_key = "Time Series (Daily)"
    else:
        params = {
            "function": "TIME_SERIES_WEEKLY",
            "symbol": ticker_symbol,
            "apikey": ALPHA_VANTAGE_KEY,
        }
        time_key = "Weekly Time Series"

    resp = req_lib.get(AV_BASE, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    series = data.get(time_key, {}) if isinstance(data, dict) else {}
    if not series:
        raise ValueError(f"Alpha Vantage: no chart data for {ticker_symbol}")

    limit_map = {"1D": 14, "1W": 7, "1M": 30, "6M": 26, "1Y": 52}
    limit = limit_map.get(period, 30)

    rows = sorted(series.items())[-limit:]

    result: list[dict] = []
    for timestamp_str, values in rows:
        if not isinstance(values, dict):
            continue

        close = safe_float(values.get("4. close"))
        if close is None:
            continue

        try:
            ts_dt = datetime.fromisoformat(timestamp_str)
            if period == "1D":
                time_label = ts_dt.strftime("%H:%M")
            elif period in ("1W", "1M"):
                time_label = ts_dt.strftime("%d %b")
            else:
                time_label = ts_dt.strftime("%b %Y")
        except Exception:
            time_label = timestamp_str[:10]

        result.append(
            {
                "time": time_label,
                "timestamp": timestamp_str,
                "open": safe_float(values.get("1. open")),
                "high": safe_float(values.get("2. high")),
                "low": safe_float(values.get("3. low")),
                "close": close,
                "volume": int(values.get("5. volume", 0) or 0),
            }
        )

    if not result:
        raise ValueError(f"Alpha Vantage: no chart data for {ticker_symbol}")

    return result


def build_synthetic_chart_from_quote(quote: dict, period: str) -> list[dict]:
    """Approximate chart from quote when OHLCV providers are rate-limited."""
    price = safe_float(quote.get("price"))
    prev_close = safe_float(quote.get("prevClose")) or price
    if price is None:
        return []

    labels_by_period = {
        "1D": ["09:30", "11:00", "13:00", "15:00", "16:00"],
        "1W": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "1M": ["W1", "W2", "W3", "W4"],
        "6M": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        "1Y": ["Q1", "Q2", "Q3", "Q4"],
    }
    labels = labels_by_period.get(period, ["Start", "Now"])
    if len(labels) < 2:
        labels = ["Open", "Now"]

    data: list[dict] = []
    last_index = len(labels) - 1
    for index, label in enumerate(labels):
        progress = index / last_index if last_index else 1.0
        close = round(prev_close + (price - prev_close) * progress, 2)
        data.append(
            {
                "time": label,
                "timestamp": datetime.utcnow().isoformat(),
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": 0,
            }
        )
    return data


def fetch_quote_yfinance(ticker_symbol: str) -> dict:
    """
    yfinance quote normalized to the exact Investio quote dict shape.
    """
    ticker = yf.Ticker(ticker_symbol, session=get_yf_session())
    info = ticker.info

    price = (
        safe_float(info.get("currentPrice"))
        or safe_float(info.get("regularMarketPrice"))
        or safe_float(info.get("previousClose"))
    )

    if price is None:
        price = fetch_price_via_download(ticker_symbol)

    if price is None:
        raise ValueError(f"No price data returned for {ticker_symbol}")

    prev_close = safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))

    if prev_close is None and price is not None:
        try:
            session2 = get_yf_session()
            df = yf.download(
                ticker_symbol,
                period="5d",
                interval="1d",
                progress=False,
                auto_adjust=True,
                session=session2,
            )
            if not df.empty and "Close" in df.columns:
                closes = df["Close"].dropna()
                if len(closes) >= 2:
                    prev_close = safe_float(closes.iloc[-2])
        except Exception:
            pass

    change = round(price - prev_close, 2) if prev_close else None
    change_pct = round((change / prev_close) * 100, 2) if prev_close and change else None

    return {
        "ticker": ticker_symbol,
        "name": info.get("longName") or info.get("shortName") or ticker_symbol,
        "price": price,
        "prevClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "changePositive": (change_pct or 0) >= 0,
        "high": safe_float(info.get("dayHigh") or info.get("regularMarketDayHigh")),
        "low": safe_float(info.get("dayLow") or info.get("regularMarketDayLow")),
        "volume": info.get("volume") or info.get("regularMarketVolume"),
        "marketCap": info.get("marketCap"),
        "currency": info.get("currency", "USD"),
    }


def fetch_chart_yfinance(ticker_symbol: str, period: str) -> list[dict]:
    """
    yfinance chart normalized to Investio list-of-dicts chart shape.
    Falls back to daily bars when intraday data is unavailable.
    """
    yf_period, yf_interval = PERIOD_MAP.get(period, ("5d", "30m"))
    session = get_yf_session()
    df = None

    try:
        df = yf.download(
            ticker_symbol,
            period=yf_period,
            interval=yf_interval,
            progress=False,
            auto_adjust=True,
            session=session,
        )
    except Exception:
        df = None

    if df is None or df.empty:
        try:
            ticker = yf.Ticker(ticker_symbol, session=session)
            df = ticker.history(period=yf_period, interval=yf_interval)
        except Exception:
            df = None

    # Intraday often rate-limits first — daily bars still work for 1D view.
    if (df is None or df.empty) and period == "1D":
        try:
            df = yf.download(
                ticker_symbol,
                period="5d",
                interval="1d",
                progress=False,
                auto_adjust=True,
                session=session,
            )
        except Exception:
            df = None

    if df is None or df.empty:
        raise ValueError(f"No chart data for {ticker_symbol}")

    data: list[dict] = []
    for timestamp, row in df.iterrows():
        try:
            close = safe_float(row.get("Close") or row.get(("Close", ticker_symbol)))
        except Exception:
            close = None

        if close is None:
            continue

        if period == "1D":
            time_label = timestamp.strftime("%H:%M") if hasattr(timestamp, "strftime") else str(timestamp)[:5]
        elif period in ("1W", "1M"):
            time_label = timestamp.strftime("%d %b")
        else:
            time_label = timestamp.strftime("%b %Y")

        try:
            open_val = safe_float(row.get("Open") or row.get(("Open", ticker_symbol)))
            high_val = safe_float(row.get("High") or row.get(("High", ticker_symbol)))
            low_val = safe_float(row.get("Low") or row.get(("Low", ticker_symbol)))
            vol_val = int(row.get("Volume") or row.get(("Volume", ticker_symbol)) or 0)
        except Exception:
            open_val = high_val = low_val = None
            vol_val = 0

        data.append(
            {
                "time": time_label,
                "timestamp": timestamp.isoformat(),
                "open": open_val,
                "high": high_val,
                "low": low_val,
                "close": close,
                "volume": vol_val,
            }
        )

    if not data:
        raise ValueError(f"No chart data for {ticker_symbol}")

    return data


def fetch_quote_sync(ticker_symbol: str) -> dict:
    """
    Fetch quote data. Prefer Finnhub when configured; fall back to yfinance / others.
    """
    if FINNHUB_API_KEY:
        try:
            return fetch_quote_finnhub(ticker_symbol)
        except Exception as fh_err:
            print(f"[Investio] Finnhub failed for {ticker_symbol}: {fh_err}")

    try:
        return fetch_quote_yfinance(ticker_symbol)
    except Exception as yf_err:
        print(f"[Investio] yfinance failed for {ticker_symbol}: {yf_err}")

    if alpha_vantage_enabled():
        try:
            return fetch_quote_alphavantage(ticker_symbol)
        except Exception as av_err:
            print(f"[Investio] Alpha Vantage failed for {ticker_symbol}: {av_err} — disabling AV for 10m")
            disable_alpha_vantage_temporarily()

    if FINCEPT_AVAILABLE:
        try:
            return fetch_quote_fincept(ticker_symbol)
        except Exception as fincept_err:
            print(f"[Investio] Fincept failed for {ticker_symbol}: {fincept_err}")

    raise ValueError(f"No quote data returned for {ticker_symbol}")


def fetch_chart_sync(ticker_symbol: str, period: str) -> list[dict]:
    """
    Fetch OHLCV chart data. Prefer Finnhub when configured; fall back to yfinance / others.
    """
    if FINNHUB_API_KEY:
        try:
            return fetch_chart_finnhub(ticker_symbol, period)
        except Exception as fh_err:
            print(f"[Investio] Finnhub chart failed for {ticker_symbol}/{period}: {fh_err}")

    try:
        return fetch_chart_yfinance(ticker_symbol, period)
    except Exception as yf_err:
        print(f"[Investio] yfinance chart failed for {ticker_symbol}/{period}: {yf_err}")

    if alpha_vantage_enabled():
        try:
            return fetch_chart_alphavantage(ticker_symbol, period)
        except Exception as av_err:
            print(f"[Investio] Alpha Vantage chart failed for {ticker_symbol}/{period}: {av_err} — disabling AV for 10m")
            disable_alpha_vantage_temporarily()

    if FINCEPT_AVAILABLE:
        try:
            return fetch_chart_fincept(ticker_symbol, period)
        except Exception as fincept_err:
            print(f"[Investio] Fincept chart failed for {ticker_symbol}/{period}: {fincept_err}")

    raise ValueError(f"No chart data for {ticker_symbol}")


# ─── Ollama AI assistant ───────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    text: str
    risk: Optional[Literal["Low", "Moderate", "High"]] = None


def parse_ai_response(full_text: str) -> ChatResponse:
    lines = [line.strip() for line in full_text.split("\n") if line.strip()]
    risk_line = next(
        (line for line in lines if line.lower().startswith("risk level:")),
        "",
    )
    main_text = " ".join(
        line for line in lines if not line.lower().startswith("risk level:")
    ).strip()
    risk_value = risk_line.split(":", 1)[-1].strip() if risk_line else ""
    risk: Optional[Literal["Low", "Moderate", "High"]] = (
        risk_value if risk_value in ("Low", "Moderate", "High") else None
    )
    return ChatResponse(
        text=main_text or full_text.strip() or "I couldn't generate a response. Please try again.",
        risk=risk,
    )


def chat_ollama_sync(message: str) -> ChatResponse:
    base_url, api_key, model = get_ollama_settings()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    response = req_lib.post(
        f"{base_url}/api/chat",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": AI_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "stream": False,
        },
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    content = (payload.get("message") or {}).get("content", "")
    if not content:
        raise ValueError("Ollama returned an empty response")
    return parse_ai_response(content)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    if ENVIRONMENT == "production":
        return {"status": "ok"}
    ollama_base, ollama_key, ollama_model = get_ollama_settings()
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "cache_keys": len(_cache),
        "market_data": {
            "primary": "finnhub" if FINNHUB_API_KEY else "yfinance",
            "finnhub": bool(FINNHUB_API_KEY),
            "alpha_vantage": bool(ALPHA_VANTAGE_KEY),
        },
        "ai": {
            "provider": "ollama",
            "model": ollama_model,
            "configured": bool(ollama_key) or ollama_base == "http://localhost:11434",
        },
    }


@app.post("/api/ai/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequest, request: Request):
    enforce_rate_limit(request)
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, lambda: chat_ollama_sync(message)
            ),
            timeout=65.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="AI request timed out. Try again.")
    except req_lib.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        detail = "AI service unavailable"
        if exc.response is not None:
            try:
                detail = exc.response.json().get("error", detail)
            except Exception:
                detail = exc.response.text[:200] or detail
        raise HTTPException(status_code=status, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/quote/{symbol}")
async def get_quote(symbol: str):
    ticker_symbol = resolve_ticker(symbol)
    cache_key = f"quote:{ticker_symbol}"
    ttl = TTL["quote"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh:
        return {**cached, "id": symbol, "stale": False, "source": "cache"}

    try:
        data = await with_retry(lambda: fetch_quote_sync(ticker_symbol))
        cache_set(cache_key, data)
        return {**data, "id": symbol, "stale": False, "source": "live"}

    except Exception as exc:
        stale = cache_get_stale(cache_key)
        if stale:
            return {**stale, "id": symbol, "stale": True, "source": "stale_cache"}
        # Keep response shape stable even when upstream data is unavailable.
        # Frontend already uses stale/static fallbacks; this avoids hard 503s.
        return {
            "ticker": ticker_symbol,
            "name": ticker_symbol,
            "price": None,
            "prevClose": None,
            "change": None,
            "changePercent": None,
            "changePositive": True,
            "high": None,
            "low": None,
            "volume": None,
            "marketCap": None,
            "currency": "USD",
            "id": symbol,
            "stale": True,
            "source": "unavailable",
        }


@app.get("/api/chart/{symbol}/{period}")
async def get_chart(symbol: str, period: str = "1W"):
    ticker_symbol = resolve_ticker(symbol)
    cache_key = f"chart:{ticker_symbol}:{period}"
    ttl = TTL["chart"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh and cached and len(cached) > 0:
        return {
            "symbol": ticker_symbol, "period": period,
            "data": cached, "count": len(cached),
            "stale": False, "source": "cache",
        }

    try:
        data = await with_retry(lambda: fetch_chart_sync(ticker_symbol, period))
        if not data:
            raise ValueError(f"No chart data for {ticker_symbol}")
        cache_set(cache_key, data)
        return {
            "symbol": ticker_symbol, "period": period,
            "data": data, "count": len(data),
            "stale": False, "source": "live",
        }

    except Exception as exc:
        stale = cache_get_stale(cache_key)
        if stale and len(stale) > 0:
            return {
                "symbol": ticker_symbol, "period": period,
                "data": stale, "count": len(stale),
                "stale": True, "source": "stale_cache",
            }

        try:
            quote = await with_retry(lambda: fetch_quote_sync(ticker_symbol))
            synthetic = build_synthetic_chart_from_quote(quote, period)
            if synthetic:
                return {
                    "symbol": ticker_symbol,
                    "period": period,
                    "data": synthetic,
                    "count": len(synthetic),
                    "stale": True,
                    "source": "synthetic",
                }
        except Exception:
            pass

        return {
            "symbol": ticker_symbol,
            "period": period,
            "data": [],
            "count": 0,
            "stale": True,
            "source": "unavailable",
        }


@app.get("/api/snapshot/{symbol}/{period}")
async def get_snapshot(symbol: str, period: str = "1W"):
    """
    Fast combined quote + chart for the home screen.
    Returns a synthetic chart immediately when live OHLCV is slow or unavailable.
    """
    ticker_symbol = resolve_ticker(symbol)
    quote_cache_key = f"quote:{ticker_symbol}"
    chart_cache_key = f"chart:{ticker_symbol}:{period}"

    quote_payload: dict
    cached_quote, quote_fresh = cache_get(quote_cache_key, TTL["quote"])
    if quote_fresh and cached_quote:
        quote_payload = {**cached_quote, "id": symbol, "stale": False, "source": "cache"}
    else:
        try:
            live_quote = await with_retry(
                lambda: fetch_quote_sync(ticker_symbol),
                max_attempts=1,
                timeout=3.0,
            )
            cache_set(quote_cache_key, live_quote)
            quote_payload = {**live_quote, "id": symbol, "stale": False, "source": "live"}
        except Exception:
            stale_quote = cache_get_stale(quote_cache_key)
            if stale_quote:
                quote_payload = {**stale_quote, "id": symbol, "stale": True, "source": "stale_cache"}
            else:
                quote_payload = {
                    "ticker": ticker_symbol,
                    "name": ticker_symbol,
                    "price": None,
                    "prevClose": None,
                    "change": None,
                    "changePercent": None,
                    "changePositive": True,
                    "high": None,
                    "low": None,
                    "volume": None,
                    "marketCap": None,
                    "currency": "USD",
                    "id": symbol,
                    "stale": True,
                    "source": "unavailable",
                }

    chart_data: list[dict] = []
    chart_source = "synthetic"

    cached_chart, chart_fresh = cache_get(chart_cache_key, TTL["chart"])
    if chart_fresh and cached_chart and len(cached_chart) > 0:
        chart_data = cached_chart
        chart_source = "cache"
    elif FINNHUB_API_KEY:
        try:
            live_chart = await with_retry(
                lambda: fetch_chart_sync(ticker_symbol, period),
                max_attempts=1,
                timeout=5.0,
            )
            if live_chart:
                chart_data = live_chart
                chart_source = "live"
                cache_set(chart_cache_key, live_chart)
        except Exception:
            pass

    if not chart_data and quote_payload.get("price") is not None:
        chart_data = build_synthetic_chart_from_quote(quote_payload, period)
        chart_source = "synthetic"

    return {
        "quote": quote_payload,
        "chart": {
            "symbol": ticker_symbol,
            "period": period,
            "data": chart_data,
            "count": len(chart_data),
        },
        "chartSource": chart_source,
    }


COMPARE_ASSET_IDS = [
    "apple",
    "microsoft",
    "alphabet",
    "nvidia",
    "amazon",
    "meta",
    "tesla",
    "netflix",
]

COMPARE_BADGE_LABELS = {
    "growth": "Best growth",
    "profitability": "Most profitable",
    "stability": "Most stable",
}


def long_term_score_from_analysis(analysis: dict) -> int:
    """Weight stability and profits higher — better for long-term holders."""
    return round(
        analysis["growth"]["pct"] * 0.25
        + analysis["profitability"]["pct"] * 0.30
        + analysis["stability"]["pct"] * 0.35
        + analysis["competition"]["pct"] * 0.10
    )


def build_compare_verdict(companies: list[dict]) -> dict:
    ranked = sorted(
        companies,
        key=lambda row: row.get("longTermScore", 0),
        reverse=True,
    )
    winner = ranked[0]
    runner = ranked[1] if len(ranked) > 1 else None
    winner_name = winner.get("name", "This company")
    analysis = winner.get("analysis", {})

    strengths: list[str] = []
    if analysis.get("stability", {}).get("pct", 0) >= 65:
        strengths.append("steady price history")
    if analysis.get("profitability", {}).get("pct", 0) >= 65:
        strengths.append("strong profits")
    if analysis.get("growth", {}).get("pct", 0) >= 65:
        strengths.append("healthy growth")

    strength_text = (
        ", ".join(strengths)
        if strengths
        else "a balanced mix of growth, profit, and safety"
    )

    summary = (
        f"Based on live market prices and company health scores, {winner_name} "
        f"scores highest for holding 5+ years. It stands out for {strength_text}."
    )

    if runner:
        gap = winner.get("longTermScore", 0) - runner.get("longTermScore", 0)
        runner_name = runner.get("name", "the runner-up")
        if gap >= 8:
            summary += (
                f" It leads {runner_name} by a clear margin — a safer long-term pick right now."
            )
        else:
            summary += (
                f" It's close with {runner_name}. Both are solid, but {winner_name} edges ahead overall."
            )

    return {
        "winnerId": winner.get("id"),
        "headline": f"{winner_name} is the best long-term pick here",
        "summary": summary,
        "tips": [
            "Think in years, not days — short dips are normal.",
            "Don't put all your money in one company; spread across 2–3 strong picks.",
            "Scores refresh with live data — check back monthly.",
        ],
    }


def build_compare_badges(companies: list[dict]) -> dict[str, str]:
    badges: dict[str, str] = {}
    for key in ("growth", "profitability", "stability"):
        best = max(
            companies,
            key=lambda row: row.get("analysis", {}).get(key, {}).get("pct", 0),
        )
        badges[key] = best.get("id", "")
    return badges


async def fetch_compare_quote(asset_id: str) -> dict:
    ticker_symbol = resolve_ticker(asset_id)
    item_key = f"quote:{ticker_symbol}"
    ttl = TTL["quote"]

    item_cached, item_fresh = cache_get(item_key, ttl)
    if item_fresh and item_cached:
        return item_cached

    try:
        data = await with_retry(
            lambda ts=ticker_symbol: fetch_quote_sync(ts),
            max_attempts=2,
            timeout=8.0,
        )
        cache_set(item_key, data)
        return data
    except Exception:
        return cache_get_stale(item_key) or {}


async def build_compare_company(asset_id: str) -> dict:
    ticker_symbol = resolve_ticker(asset_id)
    quote_data = await fetch_compare_quote(asset_id)
    company_name = quote_data.get("name") or asset_id.replace("_", " ").title()

    sentiment = build_sentiment_sync(asset_id, ticker_symbol, company_name)
    analysis = sentiment["analysis"]
    long_term_score = long_term_score_from_analysis(analysis)

    change_pct = quote_data.get("changePercent")
    return {
        "id": asset_id,
        "ticker": ticker_symbol,
        "name": company_name,
        "price": quote_data.get("price"),
        "change": quote_data.get("change"),
        "changePercent": change_pct,
        "changePositive": quote_data.get(
            "changePositive",
            (change_pct or 0) >= 0,
        ),
        "currency": quote_data.get("currency") or "USD",
        "aiScore": sentiment["aiScore"],
        "rating": sentiment["rating"],
        "explanation": sentiment["explanation"],
        "analysis": analysis,
        "longTermScore": long_term_score,
        "isWinner": False,
    }


@app.get("/api/compare")
async def get_compare():
    cache_key = "compare:full"
    ttl = TTL["compare"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if (
        is_fresh
        and isinstance(cached, dict)
        and cached.get("companies")
        and cached.get("compareVersion") == 2
        and cached.get("verdict")
    ):
        return {**cached, "stale": False, "source": "cache"}

    companies: list[dict] = []
    semaphore = asyncio.Semaphore(3)

    async def fetch_one(asset_id: str) -> dict:
        async with semaphore:
            return await build_compare_company(asset_id)

    companies = list(
        await asyncio.gather(*(fetch_one(asset_id) for asset_id in COMPARE_ASSET_IDS))
    )

    verdict = build_compare_verdict(companies)
    badges = build_compare_badges(companies)
    winner_id = verdict.get("winnerId")

    for company in companies:
        company["isWinner"] = company.get("id") == winner_id
        company["badges"] = [
            COMPARE_BADGE_LABELS[key]
            for key, asset_id in badges.items()
            if asset_id == company.get("id")
        ]

    payload = {
        "companies": companies,
        "verdict": verdict,
        "badges": badges,
        "updatedAt": datetime.utcnow().isoformat(),
        "stale": any(row.get("price") is None for row in companies),
        "source": "live",
        "compareVersion": 2,
    }
    cache_set(cache_key, payload)
    return payload


def apply_ai_insight(item: dict, rank: int) -> dict:
    """Derive AI score and short prediction from live price momentum."""
    change = float(item.get("changePercent") or 0)
    score = round(min(98, max(38, 52 + change * 5 + max(0, 21 - rank) * 1.5)))

    if rank <= 3 and change >= 2:
        prediction = f"AI #{rank} pick — strongest live momentum, likely to lead today"
        rating = "Strong Buy"
        rating_color = "green"
    elif change >= 1.5:
        prediction = "AI sees continued upside from today's live market strength"
        rating = "Buy"
        rating_color = "green"
    elif change >= 0.5:
        prediction = "AI flags steady gains — good short-term hold candidate"
        rating = "Hold"
        rating_color = "gold"
    elif change >= 0:
        prediction = "AI notes modest gains — watch for breakout confirmation"
        rating = "Hold"
        rating_color = "gold"
    else:
        prediction = "AI ranks lower today — weaker live session vs peers"
        rating = "Caution"
        rating_color = "red"

    return {
        **item,
        "rank": rank,
        "aiScore": score,
        "aiPrediction": prediction,
        "rating": rating,
        "ratingColor": rating_color,
    }


async def fetch_insight_item(asset_id: str) -> Optional[dict]:
    ticker_symbol = resolve_ticker(asset_id)
    item_key = f"quote:{ticker_symbol}"
    ttl = TTL["quote"]

    item_cached, item_fresh = cache_get(item_key, ttl)
    if item_fresh and item_cached:
        data = item_cached
    else:
        try:
            data = await with_retry(
                lambda ts=ticker_symbol: fetch_quote_sync(ts),
                max_attempts=1,
                timeout=6.0,
            )
            cache_set(item_key, data)
        except Exception:
            data = cache_get_stale(item_key) or {}

    change_pct = data.get("changePercent")
    if change_pct is None or data.get("price") is None:
        return None

    return {
        "id": asset_id,
        "ticker": ticker_symbol,
        "name": data.get("name") or asset_id.replace("_", " ").title(),
        "price": data.get("price"),
        "change": data.get("change"),
        "changePercent": change_pct,
        "changePositive": data.get("changePositive", change_pct >= 0),
        "currency": data.get("currency") or "USD",
    }


async def build_live_top_insights() -> dict:
    semaphore = asyncio.Semaphore(8)

    async def fetch_limited(asset_id: str) -> Optional[dict]:
        async with semaphore:
            return await fetch_insight_item(asset_id)

    raw = await asyncio.gather(*(fetch_limited(asset_id) for asset_id in INSIGHT_ASSET_IDS))
    ranked = sorted(
        [item for item in raw if item is not None],
        key=lambda row: float(row["changePercent"]),
        reverse=True,
    )[:INSIGHT_TOP_N]

    top = [apply_ai_insight(item, index + 1) for index, item in enumerate(ranked)]
    stale_any = len(top) < INSIGHT_TOP_N

    return {
        "assets": top,
        "count": len(top),
        "updatedAt": datetime.utcnow().isoformat(),
        "stale": stale_any,
        "source": "live",
    }


@app.get("/api/insights")
async def get_insights():
    cache_key = "insights:top20"
    ttl = TTL["insights"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh and cached:
        return {**cached, "stale": cached.get("stale", False), "source": "cache"}

    payload = await build_live_top_insights()
    cache_set(cache_key, payload)
    return payload


@app.get("/api/insights/legacy")
async def get_insights_legacy():
    cache_key = "insights:all"
    ttl = TTL["insights"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh:
        return {"assets": cached, "stale": False, "source": "cache"}

    insight_ids = ["aitech", "energy", "crypto"]
    results = []

    for i, asset_id in enumerate(insight_ids):
        # FIX 1: stagger batch calls
        if i > 0:
            await asyncio.sleep(BATCH_STAGGER_DELAY)

        ticker_symbol = resolve_ticker(asset_id)
        item_key = f"quote:{ticker_symbol}"

        item_cached, item_fresh = cache_get(item_key, ttl)
        if item_fresh:
            results.append({
                "id": asset_id, "ticker": ticker_symbol,
                "price": item_cached.get("price"),
                "change": item_cached.get("change"),
                "changePercent": item_cached.get("changePercent"),
                "changePositive": item_cached.get("changePositive", True),
            })
            continue

        try:
            data = await with_retry(lambda ts=ticker_symbol: fetch_quote_sync(ts))
            cache_set(item_key, data)
            results.append({
                "id": asset_id, "ticker": ticker_symbol,
                "price": data.get("price"),
                "change": data.get("change"),
                "changePercent": data.get("changePercent"),
                "changePositive": data.get("changePositive", True),
            })
        except Exception:
            stale_item = cache_get_stale(item_key)
            if stale_item:
                results.append({
                    "id": asset_id, "ticker": ticker_symbol,
                    "price": stale_item.get("price"),
                    "change": stale_item.get("change"),
                    "changePercent": stale_item.get("changePercent"),
                    "changePositive": stale_item.get("changePositive", True),
                })
            else:
                results.append({
                    "id": asset_id, "ticker": ticker_symbol,
                    "price": None, "change": None,
                    "changePercent": None, "changePositive": True,
                })

    cache_set(cache_key, results)
    stale_any = any(r["price"] is None for r in results)
    return {"assets": results, "stale": stale_any, "source": "live"}


@app.get("/api/cache/status")
async def cache_status(request: Request):
    require_admin(request)
    now = time.time()
    status = {}
    for key, entry in _cache.items():
        age = now - entry["fetched_at"]
        status[key] = {
            "age_seconds": round(age, 1),
            "fetched_at": datetime.utcfromtimestamp(entry["fetched_at"]).isoformat(),
        }
    return {"cached_keys": len(_cache), "entries": status}


@app.delete("/api/cache/clear")
async def cache_clear(request: Request):
    require_admin(request)
    count = len(_cache)
    _cache.clear()
    return {"cleared": count}


# ─── Sentiment / AI traffic-light analysis ────────────────────────────────────

STATIC_FUNDAMENTALS: dict[str, dict[str, float]] = {
    "aitech":    {"revenue_growth": 0.12, "profit_margin": 0.22, "beta": 1.15},
    "energy":    {"revenue_growth": 0.04, "profit_margin": 0.18, "beta": 0.95},
    "crypto":    {"revenue_growth": 0.25, "profit_margin": 0.05, "beta": 2.10},
    "apple":     {"revenue_growth": 0.08, "profit_margin": 0.26, "beta": 1.20},
    "microsoft": {"revenue_growth": 0.14, "profit_margin": 0.36, "beta": 0.90},
    "alphabet":  {"revenue_growth": 0.10, "profit_margin": 0.24, "beta": 1.05},
    "tesla":     {"revenue_growth": 0.18, "profit_margin": 0.12, "beta": 1.85},
    "amazon":    {"revenue_growth": 0.11, "profit_margin": 0.08, "beta": 1.25},
    "nvidia":    {"revenue_growth": 0.55, "profit_margin": 0.48, "beta": 1.70},
    "meta":      {"revenue_growth": 0.16, "profit_margin": 0.30, "beta": 1.30},
    "netflix":   {"revenue_growth": 0.09, "profit_margin": 0.16, "beta": 1.40},
}

DEFAULT_FUNDAMENTALS = {"revenue_growth": 0.06, "profit_margin": 0.15, "beta": 1.10}


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _fundamentals_for_asset(asset_id: str) -> dict[str, float]:
    return STATIC_FUNDAMENTALS.get(asset_id.lower(), DEFAULT_FUNDAMENTALS)


def fetch_fundamentals_alphavantage(ticker_symbol: str) -> Optional[dict[str, float]]:
    if not ALPHA_VANTAGE_KEY:
        return None
    try:
        resp = req_lib.get(
            AV_BASE,
            params={
                "function": "OVERVIEW",
                "symbol": ticker_symbol,
                "apikey": ALPHA_VANTAGE_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict) or not data.get("Symbol"):
            return None
        growth = safe_float(data.get("QuarterlyRevenueGrowthYOY"))
        margin = safe_float(data.get("ProfitMargin"))
        beta = safe_float(data.get("Beta"))
        return {
            "revenue_growth": growth if growth is not None else DEFAULT_FUNDAMENTALS["revenue_growth"],
            "profit_margin": margin if margin is not None else DEFAULT_FUNDAMENTALS["profit_margin"],
            "beta": beta if beta is not None else DEFAULT_FUNDAMENTALS["beta"],
        }
    except Exception:
        return None


def fetch_news_sentiment_alphavantage(ticker_symbol: str) -> Optional[float]:
    if not ALPHA_VANTAGE_KEY:
        return None
    try:
        resp = req_lib.get(
            AV_BASE,
            params={
                "function": "NEWS_SENTIMENT",
                "tickers": ticker_symbol,
                "limit": 20,
                "apikey": ALPHA_VANTAGE_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        feed = data.get("feed", []) if isinstance(data, dict) else []
        scores = []
        for item in feed:
            if not isinstance(item, dict):
                continue
            for ts in item.get("ticker_sentiment", []):
                if isinstance(ts, dict) and ts.get("ticker") == ticker_symbol:
                    score = safe_float(ts.get("ticker_sentiment_score"))
                    if score is not None:
                        scores.append((score + 1) * 50)
        if scores:
            return _clamp_score(sum(scores) / len(scores))
    except Exception:
        pass
    return None


def fetch_news_sentiment_newsapi(company_name: str) -> Optional[float]:
    if not NEWS_API_KEY:
        return None
    try:
        resp = req_lib.get(
            f"{NEWS_API_BASE}/everything",
            params={
                "q": company_name,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 20,
                "apiKey": NEWS_API_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        articles = data.get("articles", []) if isinstance(data, dict) else []
        if not articles:
            return None
        positive = sum(
            1 for a in articles
            if isinstance(a, dict) and "gain" in (a.get("title") or "").lower()
        )
        negative = sum(
            1 for a in articles
            if isinstance(a, dict) and "loss" in (a.get("title") or "").lower()
        )
        if positive + negative == 0:
            return 50.0
        return _clamp_score(50 + ((positive - negative) / len(articles)) * 50)
    except Exception:
        return None


def calculate_traffic_lights(
    fundamentals: dict[str, float],
    news_sentiment_score: float,
) -> dict[str, Any]:
    growth = fundamentals.get("revenue_growth", DEFAULT_FUNDAMENTALS["revenue_growth"])
    margin = fundamentals.get("profit_margin", DEFAULT_FUNDAMENTALS["profit_margin"])
    beta = fundamentals.get("beta", DEFAULT_FUNDAMENTALS["beta"])

    growth_score = _clamp_score(40 + growth * 250)
    profit_score = _clamp_score(margin * 280)
    stability_score = _clamp_score(100 - max(0, beta - 0.8) * 35)
    competition_score = _clamp_score(news_sentiment_score)

    ai_score = round(
        growth_score * 0.30
        + profit_score * 0.25
        + stability_score * 0.20
        + competition_score * 0.25
    )

    def score_label(score: float) -> tuple[str, str]:
        if score >= 65:
            return "Good", "green"
        elif score >= 40:
            return "Average", "gold"
        else:
            return "Risky", "red"

    def rating_label(score: float) -> str:
        if score >= 70:
            return "Looks Good to Invest"
        if score >= 55:
            return "Could Be Worth It"
        if score >= 40:
            return "Be Careful With This One"
        return "Too Risky Right Now"

    def plain_explanation(growth_val: float, profit_val: float, stability_val: float, competition_val: float) -> str:
        parts = []

        if growth_val >= 65:
            parts.append("This company is growing fast")
        elif growth_val >= 40:
            parts.append("This company is growing slowly")
        else:
            parts.append("This company is not growing much right now")

        if profit_val >= 65:
            parts.append("it makes good money")
        elif profit_val >= 40:
            parts.append("it makes some money")
        else:
            parts.append("it is not making much profit")

        if stability_val < 40:
            parts.append("but the price goes up and down a lot")
        elif stability_val >= 65:
            parts.append("and the price is quite stable")

        if competition_val < 40:
            parts.append("The news about this company is not great right now")
        elif competition_val >= 65:
            parts.append("The news about this company is mostly positive")

        return ". ".join(p.capitalize() for p in parts) + "."

    g_label, g_color = score_label(growth_score)
    p_label, p_color = score_label(profit_score)
    s_label, s_color = score_label(stability_score)
    c_label, c_color = score_label(competition_score)

    explanation = plain_explanation(
        growth_score, profit_score, stability_score, competition_score
    )

    return {
        "aiScore": ai_score,
        "rating": rating_label(ai_score),
        "explanation": explanation,
        "analysis": {
            "growth": {
                "pct": round(growth_score),
                "label": g_label,
                "color": g_color,
            },
            "profitability": {
                "pct": round(profit_score),
                "label": p_label,
                "color": p_color,
            },
            "stability": {
                "pct": round(stability_score),
                "label": s_label,
                "color": s_color,
            },
            "competition": {
                "pct": round(competition_score),
                "label": c_label,
                "color": c_color,
            },
        },
        "newsSentimentScore": round(news_sentiment_score, 1),
        "sources": {
            "fundamentals": "alphavantage" if ALPHA_VANTAGE_KEY else "static",
            "sentiment": (
                "newsapi" if NEWS_API_KEY else (
                    "alphavantage" if ALPHA_VANTAGE_KEY else "static"
                )
            ),
        },
    }


def build_sentiment_sync(asset_id: str, ticker_symbol: str, company_name: str) -> dict[str, Any]:
    fundamentals = fetch_fundamentals_alphavantage(ticker_symbol)
    if fundamentals is None:
        fundamentals = _fundamentals_for_asset(asset_id)

    news_score = fetch_news_sentiment_newsapi(company_name)
    if news_score is None:
        news_score = fetch_news_sentiment_alphavantage(ticker_symbol)
    if news_score is None:
        news_score = 45.0 + (hash(asset_id) % 30)

    result = calculate_traffic_lights(fundamentals, news_score)
    result["id"] = asset_id
    result["ticker"] = ticker_symbol
    return result


@app.get("/api/sentiment/{symbol}")
async def get_sentiment(symbol: str):
    asset_id = symbol.lower()
    ticker_symbol = resolve_ticker(asset_id)
    cache_key = f"sentiment:{asset_id}"
    ttl = TTL["sentiment"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh:
        return {**cached, "stale": False}

    company_name = ticker_symbol
    quote_key = f"quote:{ticker_symbol}"
    quote_cached = cache_get_stale(quote_key)
    if quote_cached and quote_cached.get("name"):
        company_name = quote_cached["name"]

    try:
        data = await with_retry(
            lambda: build_sentiment_sync(asset_id, ticker_symbol, company_name),
            timeout=12.0,
        )
        cache_set(cache_key, data)
        return {**data, "stale": False}
    except Exception:
        stale = cache_get_stale(cache_key)
        if stale:
            return {**stale, "stale": True}
        data = build_sentiment_sync(asset_id, ticker_symbol, company_name)
        return {**data, "stale": True}


# ─── Startup cache warm ───────────────────────────────────────────────────────

@app.on_event("startup")
async def warm_cache():
    """
    Pre-fetch the most commonly used symbols on server start.
    Staggered to avoid triggering Yahoo rate limits immediately.
    Failures are silently ignored — cache warm is best-effort only.
    """
    asyncio.create_task(_warm_cache_task())


async def _warm_cache_task():
    warm_targets = [
        ("quote", "QQQ"),
        ("quote", "AAPL"),
        ("quote", "MSFT"),
        ("quote", "TSLA"),
        ("quote", "NVDA"),
        ("quote", "XLE"),
        ("quote", "BTC-USD"),
        ("chart", "QQQ", "1D"),
        ("chart", "AAPL", "1D"),
    ]

    for target in warm_targets:
        await asyncio.sleep(0.8)   # stagger each warm request by 0.8s
        try:
            if target[0] == "quote":
                ts = target[1]
                cache_key = f"quote:{ts}"
                cached, fresh = cache_get(cache_key, TTL["quote"])
                if not fresh:
                    data = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, lambda t=ts: fetch_quote_sync(t)
                        ),
                        timeout=8.0,
                    )
                    cache_set(cache_key, data)

            elif target[0] == "chart":
                ts, period = target[1], target[2]
                cache_key = f"chart:{ts}:{period}"
                cached, fresh = cache_get(cache_key, TTL["chart"])
                if not fresh:
                    data = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, lambda t=ts, p=period: fetch_chart_sync(t, p)
                        ),
                        timeout=8.0,
                    )
                    cache_set(cache_key, data)

        except Exception:
            pass   # warm failures never crash the server

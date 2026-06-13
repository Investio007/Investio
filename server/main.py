from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import requests as req_lib
import os
from dotenv import load_dotenv
import math
import time
import random
import asyncio
from datetime import datetime
from typing import Any, Optional

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

load_dotenv()
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
AV_BASE = "https://www.alphavantage.co/query"
NEWS_API_BASE = "https://newsapi.org/v2"

app = FastAPI(title="Investio Market Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# ─── TTL config (seconds) ─────────────────────────────────────────────────────

TTL = {
    "quote":     60,
    "chart":     300,
    "compare":   60,
    "insights":  60,
    "sentiment": 300,
}

# ─── Retry config ─────────────────────────────────────────────────────────────

RETRY_MAX_ATTEMPTS = 4      # up from 3
RETRY_BASE_DELAY   = 2.0    # up from 1.0 — gives Yahoo more recovery time
BATCH_STAGGER_DELAY = 0.5   # seconds between tickers in batch calls

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
    return SYMBOL_MAP.get(symbol, symbol.upper())


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

    return result


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
    """
    yf_period, yf_interval = PERIOD_MAP.get(period, ("5d", "30m"))

    try:
        df = yf.download(
            ticker_symbol,
            period=yf_period,
            interval=yf_interval,
            progress=False,
            auto_adjust=True,
            session=get_yf_session(),
        )
    except Exception:
        df = None

    if df is None or df.empty:
        ticker = yf.Ticker(ticker_symbol, session=get_yf_session())
        df = ticker.history(period=yf_period, interval=yf_interval)

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
            time_label = timestamp.strftime("%H:%M")
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

    return data


def fetch_quote_sync(ticker_symbol: str) -> dict:
    """
    Fetch quote data. Tries Ticker().info first (has more metadata),
    falls back to download() for the price if info returns nothing useful.
    """
    if ALPHA_VANTAGE_KEY:
        try:
            return fetch_quote_alphavantage(ticker_symbol)
        except Exception as av_err:
            print(f"[Investio] Alpha Vantage failed for {ticker_symbol}: {av_err} — trying yfinance")

    # Keep Fincept as optional primary if it becomes installable later
    if FINCEPT_AVAILABLE:
        try:
            return fetch_quote_fincept(ticker_symbol)
        except Exception as fincept_err:
            print(f"[Investio] Fincept failed for {ticker_symbol}: {fincept_err} — trying yfinance")

    return fetch_quote_yfinance(ticker_symbol)


def fetch_chart_sync(ticker_symbol: str, period: str) -> list[dict]:
    """
    Fetch OHLCV chart data using yfinance download() directly.
    download() is less prone to rate limiting than Ticker().history().
    """
    if ALPHA_VANTAGE_KEY:
        try:
            return fetch_chart_alphavantage(ticker_symbol, period)
        except Exception as av_err:
            print(f"[Investio] Alpha Vantage chart failed for {ticker_symbol}/{period}: {av_err} — trying yfinance")

    if FINCEPT_AVAILABLE:
        try:
            return fetch_chart_fincept(ticker_symbol, period)
        except Exception as fincept_err:
            print(f"[Investio] Fincept chart failed for {ticker_symbol}/{period}: {fincept_err} — trying yfinance")

    return fetch_chart_yfinance(ticker_symbol, period)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "cache_keys": len(_cache),
    }


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
    if is_fresh:
        return {
            "symbol": ticker_symbol, "period": period,
            "data": cached, "count": len(cached),
            "stale": False, "source": "cache",
        }

    try:
        data = await with_retry(lambda: fetch_chart_sync(ticker_symbol, period))
        cache_set(cache_key, data)
        return {
            "symbol": ticker_symbol, "period": period,
            "data": data, "count": len(data),
            "stale": False, "source": "live",
        }

    except Exception as exc:
        stale = cache_get_stale(cache_key)
        if stale:
            return {
                "symbol": ticker_symbol, "period": period,
                "data": stale, "count": len(stale),
                "stale": True, "source": "stale_cache",
            }
        return {
            "symbol": ticker_symbol,
            "period": period,
            "data": [],
            "count": 0,
            "stale": True,
            "source": "unavailable",
        }


@app.get("/api/compare")
async def get_compare():
    cache_key = "compare:all"
    ttl = TTL["compare"]

    cached, is_fresh = cache_get(cache_key, ttl)
    if is_fresh:
        return {"companies": cached, "stale": False, "source": "cache"}

    compare_ids = ["apple", "microsoft", "alphabet"]
    results = []

    for i, asset_id in enumerate(compare_ids):
        # FIX 1: stagger batch calls to avoid burst rate limiting
        if i > 0:
            await asyncio.sleep(BATCH_STAGGER_DELAY)

        ticker_symbol = resolve_ticker(asset_id)
        item_key = f"quote:{ticker_symbol}"

        item_cached, item_fresh = cache_get(item_key, ttl)
        if item_fresh:
            results.append({
                "id": asset_id, "ticker": ticker_symbol,
                "name": item_cached.get("name", ticker_symbol),
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
                "name": data.get("name", ticker_symbol),
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
                    "name": stale_item.get("name", ticker_symbol),
                    "price": stale_item.get("price"),
                    "change": stale_item.get("change"),
                    "changePercent": stale_item.get("changePercent"),
                    "changePositive": stale_item.get("changePositive", True),
                })
            else:
                results.append({
                    "id": asset_id, "ticker": ticker_symbol,
                    "name": ticker_symbol,
                    "price": None, "change": None,
                    "changePercent": None, "changePositive": True,
                })

    cache_set(cache_key, results)
    stale_any = any(r["price"] is None for r in results)
    return {"companies": results, "stale": stale_any, "source": "live"}


@app.get("/api/insights")
async def get_insights():
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
async def cache_status():
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
async def cache_clear():
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

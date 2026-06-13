"""
Investio — Fincept Terminal Diagnostic
Prints every attribute and method available on quote and history objects.
Run this before mapping Fincept to Investio's response shape.
"""

print("=" * 60)
print("FINCEPT TERMINAL DIAGNOSTIC")
print("=" * 60)

# ── 1. Import check ──────────────────────────────────────────
print("\n[1] Import check...")
try:
    from fincept_terminal import FinceptClient
    print("    ✅ FinceptClient imported successfully")
except ImportError as e:
    print(f"    ❌ Import failed: {e}")
    print("    Run: pip install fincept-terminal")
    exit(1)

# ── 2. Client instantiation ───────────────────────────────────
print("\n[2] Client instantiation...")
try:
    client = FinceptClient()
    print(f"    ✅ FinceptClient() created: {type(client)}")
    print(f"    Available methods: {[m for m in dir(client) if not m.startswith('_')]}")
except Exception as e:
    print(f"    ❌ Instantiation failed: {e}")
    exit(1)

# ── 3. Quote for a known US stock ─────────────────────────────
print("\n[3] Quote test — AAPL...")
try:
    quote = client.quote("AAPL")
    print(f"    Type: {type(quote)}")
    print(f"    dir(): {[a for a in dir(quote) if not a.startswith('_')]}")
    try:
        print(f"    vars(): {vars(quote)}")
    except Exception:
        pass
    # Try common attribute names
    for attr in [
        "price",
        "current_price",
        "regularMarketPrice",
        "previous_close",
        "prev_close",
        "previousClose",
        "change",
        "changePercent",
        "percent_change",
        "name",
        "long_name",
        "shortName",
        "currency",
        "volume",
        "market_cap",
    ]:
        val = getattr(quote, attr, "NOT FOUND")
        if val != "NOT FOUND":
            print(f"    quote.{attr} = {val}")
except Exception as e:
    print(f"    ❌ Quote failed: {e}")

# ── 4. Quote for crypto ───────────────────────────────────────
print("\n[4] Quote test — BTC (crypto)...")
for symbol in ["BTC", "BTC-USD", "BTCUSD"]:
    try:
        q = client.quote(symbol)
        price = getattr(q, "price", None) or getattr(q, "current_price", None)
        print(f"    client.quote('{symbol}') → price={price} ✅")
        break
    except Exception as e:
        print(f"    client.quote('{symbol}') → ❌ {e}")

# ── 5. Quote for ETF ──────────────────────────────────────────
print("\n[5] Quote test — QQQ (ETF)...")
try:
    q = client.quote("QQQ")
    price = getattr(q, "price", None) or getattr(q, "current_price", None)
    print(f"    QQQ price = {price}")
except Exception as e:
    print(f"    ❌ {e}")

# ── 6. Quote for new stocks (the ones returning 503) ──────────
print("\n[6] Quote test — new symbols (TSLA, NVDA, AMZN, META)...")
for symbol in ["TSLA", "NVDA", "AMZN", "META"]:
    try:
        q = client.quote(symbol)
        price = getattr(q, "price", None) or getattr(q, "current_price", None)
        print(f"    {symbol}: price={price} ✅")
    except Exception as e:
        print(f"    {symbol}: ❌ {e}")

# ── 7. History / chart method ─────────────────────────────────
print("\n[7] History method check — AAPL 5d/30m...")
history_method = None
for method_name in ["history", "get_history", "historical", "ohlcv", "chart"]:
    if hasattr(client, method_name):
        print(f"    Found method: client.{method_name}()")
        history_method = method_name
        break

if history_method is None:
    print("    ❌ No history method found on client")
    print(f"    All client methods: {[m for m in dir(client) if not m.startswith('_')]}")
else:
    try:
        # Try common signatures
        hist = None
        for call in [
            lambda: getattr(client, history_method)("AAPL", period="5d", interval="30m"),
            lambda: getattr(client, history_method)("AAPL", "5d", "30m"),
            lambda: getattr(client, history_method)("AAPL"),
        ]:
            try:
                hist = call()
                break
            except Exception:
                continue

        if hist is not None:
            print(f"    Type: {type(hist)}")
            if hasattr(hist, "head"):
                print(f"    DataFrame head:\n{hist.head(3)}")
                print(f"    Columns: {list(hist.columns)}")
            elif isinstance(hist, list):
                print(f"    List length: {len(hist)}")
                if hist:
                    print(f"    First item: {hist[0]}")
            else:
                print(f"    Value: {hist}")
        else:
            print("    ❌ All history call signatures failed")
    except Exception as e:
        print(f"    ❌ History call failed: {e}")

# ── 8. Check for search / ticker lookup ───────────────────────
print("\n[8] Search / ticker lookup methods...")
for method_name in ["search", "find", "lookup", "get_ticker", "ticker"]:
    if hasattr(client, method_name):
        print(f"    Found: client.{method_name}()")

# ── 9. Check for JSE / South African support ─────────────────
print("\n[9] JSE support test — NPN (Naspers)...")
for symbol in ["NPN", "NPN.JO", "NPN.JSE"]:
    try:
        q = client.quote(symbol)
        price = getattr(q, "price", None) or getattr(q, "current_price", None)
        print(f"    client.quote('{symbol}') → price={price} ✅")
        break
    except Exception as e:
        print(f"    client.quote('{symbol}') → ❌ {e}")

print("\n" + "=" * 60)
print("DIAGNOSTIC COMPLETE")
print("Share the full output above before applying any code changes.")
print("=" * 60)


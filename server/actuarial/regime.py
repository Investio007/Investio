"""
Layer 5: Market Regime Detection — Bull vs Bear vs Neutral
Source: Hardy (2003) Investment Guarantees, Ch. 7
        Two-state regime-switching model (simplified)
"""

import numpy as np


def detect_market_regime(prices: list[float]) -> dict:
    """
    Detect the current market regime using rolling statistics.

    Inspired by Hardy (2003) Investment Guarantees, Chapter 7:
    Hardy uses a two-state hidden Markov model with:
      State 1 (Bull): high drift, low volatility
      State 2 (Bear): low/negative drift, high volatility
    """
    if len(prices) < 30:
        return _neutral_regime("Insufficient price history for regime detection")

    prices_arr = np.array(prices, dtype=float)
    log_returns = np.diff(np.log(prices_arr[prices_arr > 0]))

    if len(log_returns) < 20:
        return _neutral_regime("Insufficient return data")

    # Recent vs long-term volatility
    recent_vol = float(np.std(log_returns[-20:]) * np.sqrt(252))
    long_vol = float(np.std(log_returns) * np.sqrt(252))

    # Recent trend (90-day if available, else all data)
    n_trend = min(63, len(log_returns))  # ~63 trading days = 3 months
    recent_trend = float(np.mean(log_returns[-n_trend:]) * 252)

    # Volatility ratio (Hardy Ch. 7 — key regime signal)
    vol_ratio = recent_vol / long_vol if long_vol > 0 else 1.0

    # 200-day moving average crossover (if enough data)
    current_price = float(prices_arr[-1])
    if len(prices_arr) >= 200:
        ma200 = float(np.mean(prices_arr[-200:]))
        above_ma200 = current_price > ma200
        ma_signal = (current_price - ma200) / ma200
    else:
        above_ma200 = True
        ma_signal = 0.0

    # Regime classification (Hardy Ch. 7 logic)
    bull_signals = 0
    bear_signals = 0

    if recent_trend > 0.08:
        bull_signals += 2
    elif recent_trend > 0.02:
        bull_signals += 1
    elif recent_trend < -0.10:
        bear_signals += 2
    elif recent_trend < -0.02:
        bear_signals += 1

    if vol_ratio < 0.9:
        bull_signals += 1
    elif vol_ratio > 1.4:
        bear_signals += 2
    elif vol_ratio > 1.2:
        bear_signals += 1

    if above_ma200:
        bull_signals += 1
    else:
        bear_signals += 1

    if ma_signal > 0.05:
        bull_signals += 1
    elif ma_signal < -0.05:
        bear_signals += 1

    # Final classification
    if bull_signals >= 4 and bear_signals <= 1:
        regime = "BULL"
        confidence = min(0.85, 0.55 + bull_signals * 0.06)
        simple_label = "Growing Market"
        description = (
            "Markets are calm and growing right now. "
            "Prices have been rising steadily. "
            "This is a better time to invest than a nervous market."
        )
        advice = "A growing market is a good time to invest for the long term."
        color = "green"
    elif bear_signals >= 4 and bull_signals <= 1:
        regime = "BEAR"
        confidence = min(0.82, 0.52 + bear_signals * 0.06)
        simple_label = "Falling Market"
        description = (
            "Markets are nervous and prices are falling. "
            "There is more risk than usual right now. "
            "Be more careful with new investments."
        )
        advice = (
            "A falling market means more risk. "
            "Consider waiting or investing smaller amounts."
        )
        color = "red"
    else:
        regime = "NEUTRAL"
        confidence = 0.50
        simple_label = "Mixed Market"
        description = (
            "Markets are going sideways — some stocks up, some down. "
            "Not clearly good or bad right now. "
            "Normal caution applies."
        )
        advice = "A mixed market is normal. Stick to your plan and do not panic."
        color = "gold"

    return {
        "regime": regime,
        "simple_label": simple_label,
        "description": description,
        "advice": advice,
        "color": color,
        "confidence": round(confidence, 2),
        "recent_volatility": round(recent_vol * 100, 1),
        "long_term_volatility": round(long_vol * 100, 1),
        "volatility_ratio": round(vol_ratio, 2),
        "recent_trend_pct": round(recent_trend * 100, 1),
        "above_200day_ma": above_ma200,
        "source": (
            "Hardy (2003) Ch. 7 — Two-state regime-switching model (simplified)"
        ),
    }


def _neutral_regime(reason: str) -> dict:
    return {
        "regime": "NEUTRAL",
        "simple_label": "Mixed Market",
        "description": "Not enough data to detect the market mood right now.",
        "advice": "Normal caution applies.",
        "color": "gold",
        "confidence": 0.50,
        "recent_volatility": 20.0,
        "long_term_volatility": 20.0,
        "volatility_ratio": 1.0,
        "recent_trend_pct": 0.0,
        "above_200day_ma": True,
        "source": f"Fallback: {reason}",
    }

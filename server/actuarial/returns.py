"""
Layer 1: Return Modelling
Source: Hardy (2003) Ch. 2, Barucci & Fontana (2017) Ch. 3
Model: Lognormal distribution of returns
"""

import numpy as np


def calculate_return_stats(prices: list[float]) -> dict:
    """
    Fit lognormal model to price history.
    Calculates annualised mean return (mu) and volatility (sigma).

    From Hardy (2003) Investment Guarantees, Chapter 2:
      - Log returns: r_t = ln(S_t / S_{t-1})
      - Annual mu = mean(r_t) * 252 trading days
      - Annual sigma = std(r_t) * sqrt(252)

    Args:
        prices: List of historical closing prices, oldest first

    Returns:
        Dictionary with annualised return statistics
    """
    if len(prices) < 10:
        return _fallback_return_stats()

    prices_arr = np.array(prices, dtype=float)
    prices_arr = prices_arr[prices_arr > 0]  # remove zero/negative prices

    if len(prices_arr) < 10:
        return _fallback_return_stats()

    # Log returns (Hardy Ch. 2, eq. 2.1)
    log_returns = np.diff(np.log(prices_arr))

    # Annualised statistics (252 trading days per year)
    mu_daily = float(np.mean(log_returns))
    sigma_daily = float(np.std(log_returns, ddof=1))

    mu_annual = mu_daily * 252
    sigma_annual = sigma_daily * np.sqrt(252)

    # Sharpe ratio (using 8.25% SA repo rate as risk-free)
    risk_free_daily = 0.0825 / 252
    excess_return = mu_daily - risk_free_daily
    sharpe = (
        float(excess_return / sigma_daily * np.sqrt(252)) if sigma_daily > 0 else 0.0
    )

    # Sortino ratio (downside deviation only)
    downside_returns = log_returns[log_returns < 0]
    downside_dev = (
        float(np.std(downside_returns) * np.sqrt(252))
        if len(downside_returns) > 1
        else sigma_annual
    )
    sortino = float((mu_annual - 0.0825) / downside_dev) if downside_dev > 0 else 0.0

    # Maximum drawdown
    cumulative = np.cumprod(1 + log_returns)
    rolling_max = np.maximum.accumulate(cumulative)
    drawdowns = (cumulative - rolling_max) / rolling_max
    max_drawdown = float(np.min(drawdowns)) if len(drawdowns) > 0 else 0.0

    # Skewness and kurtosis (Hardy Ch. 2)
    skewness = (
        float(np.mean(((log_returns - mu_daily) / sigma_daily) ** 3))
        if sigma_daily > 0
        else 0.0
    )
    excess_kurtosis = (
        float(np.mean(((log_returns - mu_daily) / sigma_daily) ** 4)) - 3
        if sigma_daily > 0
        else 0.0
    )

    return {
        "mu": float(mu_annual),
        "sigma": float(sigma_annual),
        "annual_expected_return": round(float(mu_annual) * 100, 2),
        "annual_volatility": round(float(sigma_annual) * 100, 2),
        "sharpe_ratio": round(float(sharpe), 3),
        "sortino_ratio": round(float(sortino), 3),
        "max_drawdown": round(float(max_drawdown) * 100, 2),
        "skewness": round(float(skewness), 3),
        "excess_kurtosis": round(float(excess_kurtosis), 3),
        "data_points": int(len(log_returns)),
        "source": "Hardy (2003) Ch. 2 — Lognormal return model",
    }


def _fallback_return_stats() -> dict:
    """Return neutral values when insufficient data."""
    return {
        "mu": 0.08,
        "sigma": 0.20,
        "annual_expected_return": 8.0,
        "annual_volatility": 20.0,
        "sharpe_ratio": 0.0,
        "sortino_ratio": 0.0,
        "max_drawdown": -15.0,
        "skewness": 0.0,
        "excess_kurtosis": 0.0,
        "data_points": 0,
        "source": "Fallback values — insufficient price history",
    }

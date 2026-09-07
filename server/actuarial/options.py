"""
Layer 3: Derivative Pricing — Black-Scholes-Merton
Source: Lo (2018) Derivative Pricing, Ch. 5-7
        Hull (2018) Options, Futures and Other Derivatives, Ch. 15
        Boudreault & Renaud (2019) Actuarial Finance, Ch. 8
"""

import numpy as np
from scipy.stats import norm


def black_scholes(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
) -> dict:
    """
    Black-Scholes-Merton option pricing formula.

    From Lo (2018) Derivative Pricing, Chapter 5:
      d1 = [ln(S/K) + (r + sigma^2/2)*T] / (sigma*sqrt(T))
      d2 = d1 - sigma*sqrt(T)
      Call = S*N(d1) - K*e^(-rT)*N(d2)
      Put  = K*e^(-rT)*N(-d2) - S*N(-d1)
    """
    if sigma <= 0 or T <= 0 or S <= 0 or K <= 0:
        return _fallback_options(S if S > 0 else 100.0)

    # Core BSM formula (Lo Ch. 5, eq. 5.1)
    sqrt_T = np.sqrt(T)
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T

    # Option prices
    discount = np.exp(-r * T)
    call = float(S * norm.cdf(d1) - K * discount * norm.cdf(d2))
    put = float(K * discount * norm.cdf(-d2) - S * norm.cdf(-d1))

    # Risk-neutral probability of gain (Hull Ch. 15)
    risk_neutral_prob_gain = float(norm.cdf(d2))

    # Greeks (Lo Ch. 7)
    delta_call = float(norm.cdf(d1))
    gamma = float(norm.pdf(d1) / (S * sigma * sqrt_T))
    vega = float(S * norm.pdf(d1) * sqrt_T / 100)
    theta_call = float(
        (
            -S * norm.pdf(d1) * sigma / (2 * sqrt_T)
            - r * K * discount * norm.cdf(d2)
        )
        / 365
    )

    # Downside protection cost as % of investment (Boudreault & Renaud Ch. 8)
    protection_cost_pct = float((put / S) * 100)

    put_call_ratio = float(put / call) if call > 0.001 else 0.0

    return {
        "call_price": round(call, 4),
        "put_price": round(put, 4),
        "risk_neutral_prob_gain_pct": round(risk_neutral_prob_gain * 100, 1),
        "risk_neutral_prob_loss_pct": round((1 - risk_neutral_prob_gain) * 100, 1),
        "downside_protection_cost_pct": round(protection_cost_pct, 2),
        "downside_protection_cost_rand": round(put, 2),
        "delta": round(delta_call, 4),
        "gamma": round(gamma, 6),
        "vega_per_1pct_vol": round(vega, 4),
        "theta_per_day": round(theta_call, 4),
        "put_call_ratio": round(put_call_ratio, 3),
        "strike": K,
        "horizon_years": T,
        "source": (
            "Lo (2018) Ch. 5-7 | Hull (2018) Ch. 15 | "
            "Boudreault & Renaud (2019) Ch. 8"
        ),
    }


def _fallback_options(S: float) -> dict:
    return {
        "call_price": 0.0,
        "put_price": 0.0,
        "risk_neutral_prob_gain_pct": 50.0,
        "risk_neutral_prob_loss_pct": 50.0,
        "downside_protection_cost_pct": 5.0,
        "downside_protection_cost_rand": S * 0.05,
        "delta": 0.5,
        "gamma": 0.0,
        "vega_per_1pct_vol": 0.0,
        "theta_per_day": 0.0,
        "put_call_ratio": 1.0,
        "strike": S,
        "horizon_years": 1.0,
        "source": "Fallback values — insufficient data for BSM",
    }

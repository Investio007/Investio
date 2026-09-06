"""
Layer 4: CAPM Alpha — Is This Stock Worth Its Risk?
Source: Barucci & Fontana (2017) Financial Markets Theory, Ch. 5
        Hull (2018) Ch. 3 (risk-free rate, market price of risk)
"""

# SA market constants
SA_REPO_RATE = 0.0825  # SARB repo rate — update dynamically if possible
SA_MARKET_RETURN = 0.12  # JSE All Share approximate long-run annual return
SA_MARKET_SIGMA = 0.16  # JSE All Share approximate annual volatility
GLOBAL_MARKET_RETURN = 0.10  # S&P 500 approximate long-run annual return


def calculate_capm_alpha(
    stock_return: float,
    risk_free_rate: float,
    beta: float,
    market_return: float = GLOBAL_MARKET_RETURN,
) -> dict:
    """
    Capital Asset Pricing Model (CAPM) and Jensen's Alpha.

    From Barucci & Fontana (2017) Financial Markets Theory, Chapter 5:
      CAPM: E[R_i] = R_f + beta_i * (E[R_m] - R_f)
      Alpha: alpha_i = E[R_i] - [R_f + beta_i * (E[R_m] - R_f)]
    """
    if beta is None or beta == 0:
        beta = 1.0

    # CAPM expected return (Barucci Ch. 5, eq. 5.3)
    market_premium = market_return - risk_free_rate
    capm_expected = risk_free_rate + beta * market_premium

    # Jensen's Alpha (Barucci Ch. 5, eq. 5.12)
    alpha = stock_return - capm_expected

    # Market price of risk (Hull Ch. 3)
    market_price_of_risk = market_premium / SA_MARKET_SIGMA

    # Treynor ratio
    treynor = (stock_return - risk_free_rate) / beta if beta != 0 else 0.0

    # Information ratio (assume 15% tracking error)
    information_ratio = alpha / 0.15

    if alpha > 0.03:
        alpha_label = "Earning more than its risk deserves — potential opportunity"
        alpha_color = "green"
    elif alpha > 0:
        alpha_label = "Fairly priced — earning roughly what its risk deserves"
        alpha_color = "green"
    elif alpha > -0.03:
        alpha_label = "Slightly below what its risk deserves — neutral"
        alpha_color = "gold"
    else:
        alpha_label = "Earning less than its risk deserves — be cautious"
        alpha_color = "red"

    return {
        "capm_expected_return_pct": round(capm_expected * 100, 2),
        "actual_return_pct": round(stock_return * 100, 2),
        "alpha_pct": round(alpha * 100, 2),
        "alpha_label": alpha_label,
        "alpha_color": alpha_color,
        "beta": round(beta, 3),
        "market_price_of_risk": round(market_price_of_risk, 3),
        "treynor_ratio": round(treynor, 3),
        "information_ratio": round(information_ratio, 3),
        "market_premium_pct": round(market_premium * 100, 2),
        "source": "Barucci & Fontana (2017) Ch. 5 — CAPM and Jensen's Alpha",
    }

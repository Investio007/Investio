"""
Layer 2: Risk Measurement — VaR and CTE
Source: Hardy (2003) Investment Guarantees, Ch. 4-5
        Wüthrich (2016) Market-Consistent Actuarial Valuation
"""

import numpy as np
from scipy.stats import norm


def calculate_var_cte(
    mu: float,
    sigma: float,
    investment: float = 10000.0,
    horizon_years: float = 1.0,
    confidence: float = 0.95,
) -> dict:
    """
    Value at Risk (VaR) and Conditional Tail Expectation (CTE).

    From Hardy (2003) Investment Guarantees:
      Ch. 4: Value at Risk under lognormal model
      Ch. 5: CTE (also called CVaR or Expected Shortfall)

    For lognormal returns over horizon T:
      S_T = S_0 * exp((mu - 0.5*sigma^2)*T + sigma*sqrt(T)*Z)
      where Z ~ N(0,1)

    VaR_alpha: The loss L such that P(Loss > L) = 1 - alpha
    CTE_alpha: E[Loss | Loss > VaR_alpha]
    """
    if sigma <= 0:
        sigma = 0.001

    # Adjusted parameters for horizon (Hardy Ch. 4, eq. 4.3)
    mu_t = (mu - 0.5 * sigma**2) * horizon_years
    sigma_t = sigma * np.sqrt(horizon_years)

    # Quantile for VaR
    alpha = 1.0 - confidence
    z_alpha = norm.ppf(alpha)  # e.g. -1.645 for 95% confidence

    # VaR: minimum loss at confidence level (Hardy Ch. 4, eq. 4.5)
    var_ratio = float(np.exp(mu_t + sigma_t * z_alpha))
    var_value = investment * var_ratio
    var_loss = max(0.0, investment - var_value)

    # CTE: expected value in worst tail (Hardy Ch. 5, eq. 5.8)
    phi_adj = float(norm.cdf(z_alpha - sigma_t))
    cte_mean = (
        investment * float(np.exp(mu_t + 0.5 * sigma_t**2)) * phi_adj / alpha
    )
    cte_loss = max(0.0, investment - cte_mean)

    # Probability of loss (Hardy Ch. 4)
    prob_loss = float(norm.cdf(-mu_t / sigma_t)) if sigma_t > 0 else 0.5

    # Expected terminal value
    expected_value = float(investment * np.exp(mu * horizon_years))

    # Probability of doubling investment
    prob_double = (
        float(1 - norm.cdf((np.log(2) - mu_t) / sigma_t)) if sigma_t > 0 else 0.0
    )

    # 1st percentile (extreme loss)
    z_01 = norm.ppf(0.01)
    extreme_loss = max(
        0.0, investment - investment * float(np.exp(mu_t + sigma_t * z_01))
    )

    return {
        "var_95": round(var_loss, 2),
        "cte_95": round(cte_loss, 2),
        "extreme_loss_1pct": round(extreme_loss, 2),
        "prob_loss_pct": round(prob_loss * 100, 1),
        "prob_double_pct": round(prob_double * 100, 1),
        "expected_terminal_value": round(expected_value, 2),
        "horizon_years": horizon_years,
        "confidence": confidence,
        "source": "Hardy (2003) Ch. 4-5 — VaR and CTE under lognormal model",
    }


def calculate_multihorizon_risk(
    mu: float,
    sigma: float,
    investment: float = 10000.0,
) -> list[dict]:
    """Calculate risk metrics across multiple time horizons."""
    results = []
    for years in [1, 3, 5, 10]:
        risk = calculate_var_cte(mu, sigma, investment, years)
        results.append(
            {
                "horizon": f"{years}Y",
                "years": years,
                "var_95": risk["var_95"],
                "cte_95": risk["cte_95"],
                "expected_value": risk["expected_terminal_value"],
                "prob_loss": risk["prob_loss_pct"],
            }
        )
    return results

"""
Layer 6: Market-Consistent Actuarial Score
Source: Wüthrich (2016) Market-Consistent Actuarial Valuation
        Combines all 5 previous layers into a single 0-100 score
"""


def market_consistent_score(
    var_95: float,
    cte_95: float,
    alpha_pct: float,
    sharpe_ratio: float,
    regime: str,
    regime_confidence: float,
    investment: float = 10000.0,
    prob_loss_pct: float = 30.0,
    risk_neutral_prob_gain_pct: float = 50.0,
) -> dict:
    """
    Combine all actuarial metrics into a single market-consistent score.

    Inspired by Wüthrich (2016) Market-Consistent Actuarial Valuation.
    Weighting: 35% Risk, 25% Alpha, 25% Sharpe, 15% Regime.
    """
    _ = cte_95  # reserved for future CTE-weighted adjustments

    # Component 1: Risk Score (35% weight)
    var_pct = (var_95 / investment) * 100 if investment > 0 else 20
    if var_pct <= 10:
        risk_score = 90.0
    elif var_pct <= 20:
        risk_score = 80.0 - (var_pct - 10) * 2
    elif var_pct <= 35:
        risk_score = 60.0 - (var_pct - 20) * 2
    elif var_pct <= 50:
        risk_score = 30.0 - (var_pct - 35) * 1
    else:
        risk_score = 10.0
    risk_score = max(5.0, min(95.0, risk_score))

    if prob_loss_pct > 40:
        risk_score *= 0.8
    elif prob_loss_pct > 30:
        risk_score *= 0.9

    # Component 2: Alpha Score (25% weight)
    if alpha_pct >= 5:
        alpha_score = 90.0
    elif alpha_pct >= 3:
        alpha_score = 80.0
    elif alpha_pct >= 1:
        alpha_score = 70.0
    elif alpha_pct >= 0:
        alpha_score = 60.0
    elif alpha_pct >= -2:
        alpha_score = 45.0
    elif alpha_pct >= -5:
        alpha_score = 30.0
    else:
        alpha_score = 15.0

    # Component 3: Sharpe Score (25% weight)
    if sharpe_ratio >= 1.5:
        sharpe_score = 95.0
    elif sharpe_ratio >= 1.0:
        sharpe_score = 85.0
    elif sharpe_ratio >= 0.7:
        sharpe_score = 75.0
    elif sharpe_ratio >= 0.5:
        sharpe_score = 65.0
    elif sharpe_ratio >= 0.3:
        sharpe_score = 55.0
    elif sharpe_ratio >= 0.0:
        sharpe_score = 45.0
    elif sharpe_ratio >= -0.3:
        sharpe_score = 30.0
    else:
        sharpe_score = 15.0

    if risk_neutral_prob_gain_pct > 65:
        sharpe_score = min(95, sharpe_score + 5)
    elif risk_neutral_prob_gain_pct < 40:
        sharpe_score = max(5, sharpe_score - 5)

    # Component 4: Regime Score (15% weight)
    base_regime = {"BULL": 80.0, "NEUTRAL": 55.0, "BEAR": 25.0}.get(regime, 55.0)
    regime_score = base_regime * regime_confidence + 55.0 * (1 - regime_confidence)

    final_score = (
        risk_score * 0.35
        + alpha_score * 0.25
        + sharpe_score * 0.25
        + regime_score * 0.15
    )
    final_score = max(5.0, min(95.0, float(final_score)))

    if final_score >= 65:
        color = "green"
        label = "Looks Good to Invest"
        summary = "Our actuarial engine says this investment looks solid right now."
    elif final_score >= 45:
        color = "gold"
        label = "Could Be Worth It — Proceed Carefully"
        summary = "There are good things here, but also some risks. Be careful."
    else:
        color = "red"
        label = "Too Risky Right Now"
        summary = (
            "The risk on this investment is too high compared to what you could gain."
        )

    return {
        "score": round(final_score),
        "color": color,
        "label": label,
        "summary": summary,
        "components": {
            "risk": round(risk_score),
            "alpha": round(alpha_score),
            "sharpe": round(sharpe_score),
            "regime": round(regime_score),
        },
        "weights": {
            "risk": "35%",
            "alpha": "25%",
            "sharpe": "25%",
            "regime": "15%",
        },
        "source": (
            "Wüthrich (2016) Market-Consistent Actuarial Valuation — "
            "weighted scoring framework"
        ),
    }

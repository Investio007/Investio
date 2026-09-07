"""
Plain English Translation Layer
Converts all actuarial metrics into Grade 9 language.
Maximum 15 words per sentence. No unexplained jargon.
"""


def translate_to_plain_english(
    metrics: dict,
    investment: float = 10000.0,
) -> dict:
    """
    Convert actuarial metrics into plain Grade 9 sentences.
    Every number gets a sentence. No jargon. No abbreviations.
    """
    lines = []

    # 1. Expected return
    er = metrics.get("annual_expected_return", 8.0)
    if er >= 20:
        lines.append(
            f"This investment could grow by about {er:.0f}% per year. "
            "That is very fast growth."
        )
    elif er >= 12:
        lines.append(
            f"This investment could grow by about {er:.0f}% per year. "
            "That is solid, strong growth."
        )
    elif er >= 6:
        lines.append(
            f"This investment grows by about {er:.0f}% per year. "
            "Steady and reasonable."
        )
    elif er >= 0:
        lines.append(
            f"This investment grows slowly — about {er:.0f}% per year. "
            "Not exciting, but stable."
        )
    else:
        lines.append(
            f"Right now, this investment is expected to lose about {abs(er):.0f}% "
            "per year. That is concerning."
        )

    # 2. Volatility
    vol = metrics.get("annual_volatility", 20.0)
    if vol >= 60:
        lines.append(
            f"But the price jumps around wildly — up or down by {vol:.0f}% "
            "in a year. Extremely unpredictable."
        )
    elif vol >= 35:
        lines.append(
            f"The price moves a lot — about {vol:.0f}% per year. "
            "This is a bumpy ride."
        )
    elif vol >= 20:
        lines.append(
            f"The price moves by about {vol:.0f}% per year. "
            "Normal ups and downs for stocks."
        )
    else:
        lines.append(
            f"The price is fairly calm — it moves about {vol:.0f}% per year. "
            "Less scary than most stocks."
        )

    # 3. VaR
    var = metrics.get("var_95", 0)
    if var > 0:
        var_pct = (var / investment) * 100
        lines.append(
            f"In a really bad year — which happens about 1 in 20 years — "
            f"you could lose up to R{var:,.0f} from a R{investment:,.0f} investment. "
            f"That is {var_pct:.0f}% of your money."
        )

    # 4. Probability of loss
    prob = metrics.get("prob_loss_pct", 30.0)
    if prob >= 50:
        lines.append(
            f"There is a {prob:.0f}% chance of losing money in any single year. "
            "That is more likely than not."
        )
    elif prob >= 35:
        lines.append(
            f"There is a {prob:.0f}% chance of losing money in any single year. "
            "That is quite high."
        )
    elif prob >= 20:
        lines.append(
            f"There is a {prob:.0f}% chance of losing money in any single year. "
            "That is moderate."
        )
    else:
        lines.append(
            f"There is only a {prob:.0f}% chance of losing money in any single year. "
            "That is relatively low."
        )

    # 5. Expected terminal value
    ev = metrics.get("expected_terminal_value", investment)
    gain = ev - investment
    if gain > 0:
        lines.append(
            f"If things go as expected, your R{investment:,.0f} could grow to "
            f"R{ev:,.0f} in one year — a gain of R{gain:,.0f}."
        )
    else:
        lines.append(
            f"If things go as expected, your R{investment:,.0f} could shrink to "
            f"R{ev:,.0f} in one year — a loss of R{abs(gain):,.0f}."
        )

    # 6. CAPM Alpha
    alpha = metrics.get("alpha_pct", 0.0)
    if alpha >= 3:
        lines.append(
            f"This stock earns {alpha:.1f}% more per year than its risk level "
            "should pay. That is a bonus — the market may not have fully priced "
            "it yet."
        )
    elif alpha >= 0:
        lines.append(
            "This stock earns roughly what its risk level should pay. "
            "It is fairly priced."
        )
    elif alpha >= -3:
        lines.append(
            f"This stock earns {abs(alpha):.1f}% less than its risk level should pay. "
            "You are accepting risk without being fully rewarded for it."
        )
    else:
        lines.append(
            f"This stock earns {abs(alpha):.1f}% less than it should for its level "
            "of risk. That is a concern — the risk is not worth it at the current "
            "price."
        )

    # 7. Market regime
    regime_desc = metrics.get("description", "")
    regime_advice = metrics.get("advice", "")
    if regime_desc:
        lines.append(regime_desc)
    if regime_advice:
        lines.append(regime_advice)

    # 8. Risk-neutral probability
    rnp = metrics.get("risk_neutral_prob_gain_pct", 50.0)
    lines.append(
        f"The market currently prices a {rnp:.0f}% chance that this investment "
        "is worth more in 1 year than today."
    )

    # 9. Downside protection cost
    prot_pct = metrics.get("downside_protection_cost_pct", 5.0)
    prot_rand = investment * (prot_pct / 100)
    lines.append(
        f"To fully protect your R{investment:,.0f} against any losses for 1 year "
        f"would cost about R{prot_rand:,.0f} — like buying insurance for your money."
    )

    # 10. Sharpe ratio
    sharpe = metrics.get("sharpe_ratio", 0.0)
    if sharpe >= 1.0:
        lines.append(
            f"The reward-to-risk ratio is strong ({sharpe:.2f}). "
            "You are being paid well for the risk you take."
        )
    elif sharpe >= 0.5:
        lines.append(
            f"The reward-to-risk ratio is decent ({sharpe:.2f}). "
            "Acceptable for a growth investment."
        )
    elif sharpe >= 0:
        lines.append(
            f"The reward-to-risk ratio is low ({sharpe:.2f}). "
            "You are not being paid much for the risk."
        )
    else:
        lines.append(
            f"The reward-to-risk ratio is negative ({sharpe:.2f}). "
            "More risk than reward right now."
        )

    return {
        "explanation": lines,
        "summary": " ".join(lines[:3]),
        "sentence_count": len(lines),
    }

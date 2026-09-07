/** Format market prices for Crowth — display currency is South African rand. */

export function normalizeListingCurrency(
  ticker: string | undefined | null,
  currency: string | undefined | null,
): string {
  const t = (ticker || "").toUpperCase().trim();
  const c = (currency || "").toUpperCase().trim();

  // Prefer explicit API currency (quotes/insights return ZAR after FX conversion)
  if (c === "ZAR") return "ZAR";
  if (t.endsWith(".JO")) return "ZAR";
  if (t.endsWith(".KS")) return "KRW";
  if (t.endsWith(".HK")) return "HKD";
  if (t === "BTC-USD" || t === "BTC" || t.endsWith("-USD")) return "USD";
  // US listings / ADRs (AAPL, BIDU, TCEHY, LRLCY, …)
  if (/^[A-Z]{1,6}$/.test(t)) return "USD";
  if (c) return c;
  // Crowth is SA-first: unknown → treat as already-rand when no ticker hint
  return "ZAR";
}

function formatAmount(price: number): string {
  return price.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a converted (or native JSE) display price. Defaults to rand. */
export function formatMarketPrice(
  price: number | null | undefined,
  currency: string | undefined | null = "ZAR",
  ticker?: string | null,
): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const code = normalizeListingCurrency(ticker, currency ?? "ZAR");
  const formatted = formatAmount(price);
  if (code === "USD") return `$${formatted}`;
  if (code === "ZAR") return `R${formatted}`;
  return `${code} ${formatted}`;
}

/** Format the pre-conversion listing price (never force ZAR). */
export function formatNativeListingPrice(
  price: number | null | undefined,
  currencyNative: string | undefined | null,
): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const code = (currencyNative || "USD").toUpperCase();
  const formatted = formatAmount(price);
  if (code === "USD") return `$${formatted}`;
  if (code === "ZAR") return `R${formatted}`;
  return `${code} ${formatted}`;
}

/** Same live-momentum formula used by /api/insights (so Home and Details stay aligned). */
export function todaysMomentumScore(
  changePercent: number,
  rank: number = 10,
): number {
  return Math.round(
    Math.min(98, Math.max(38, 52 + changePercent * 5 + Math.max(0, 21 - rank) * 1.5)),
  );
}

export function momentumRating(changePercent: number, rank: number = 10): {
  rating: string;
  ratingColor: "green" | "gold" | "red";
} {
  if (rank <= 3 && changePercent >= 2) {
    return { rating: "Strong Buy", ratingColor: "green" };
  }
  if (changePercent >= 1.5) return { rating: "Buy", ratingColor: "green" };
  if (changePercent >= 0.5) return { rating: "Hold", ratingColor: "gold" };
  if (changePercent >= 0) return { rating: "Hold", ratingColor: "gold" };
  return { rating: "Caution", ratingColor: "red" };
}

export function analysisFromScore(score: number): {
  growth: { label: string; color: "green" | "gold" | "red"; pct: number };
  profitability: { label: string; color: "green" | "gold" | "red"; pct: number };
  stability: { label: string; color: "green" | "gold" | "red"; pct: number };
  competition: { label: string; color: "green" | "gold" | "red"; pct: number };
} {
  const pct = Math.min(95, Math.max(18, Math.round(score)));
  const band =
    score >= 70
      ? ({ label: "Good", color: "green" as const })
      : score >= 55
        ? ({ label: "Average", color: "gold" as const })
        : ({ label: "Risky", color: "red" as const });
  return {
    growth: { ...band, pct },
    profitability: { ...band, pct: Math.min(95, pct - 5) },
    stability: { ...band, pct: Math.min(95, pct - 8) },
    competition: { ...band, pct: Math.max(20, pct - 12) },
  };
}

import type { QuoteData } from "../services/marketApi";
import type { InvestioAsset } from "../data/assets";

export function formatQuotePrice(quote: QuoteData | undefined | null): string {
  if (quote?.price == null) return "—";
  const prefix =
    quote.currency === "USD"
      ? "$"
      : quote.currency === "ZAR"
        ? "R"
        : `${quote.currency} `;
  return `${prefix}${quote.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRand(amount: number): string {
  return `R${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatChangePercent(quote: QuoteData | undefined | null): string {
  if (quote?.changePercent == null) return "—";
  const sign = quote.changePositive ? "+" : "";
  return `${sign}${quote.changePercent.toFixed(2)}%`;
}

export type PortfolioPerformance = {
  totalValue: number;
  perHoldingValue: number;
  avgChangePercent: number | null;
  dayPnl: number | null;
  gainers: number;
  losers: number;
  flat: number;
  quotedCount: number;
  holdingCount: number;
};

export function computePortfolioPerformance(
  holdings: InvestioAsset[],
  quotes: Record<string, QuoteData>,
  totalValue: number,
): PortfolioPerformance {
  const holdingCount = holdings.length;
  const perHoldingValue = holdingCount > 0 ? totalValue / holdingCount : 0;

  let changeSum = 0;
  let quotedCount = 0;
  let gainers = 0;
  let losers = 0;
  let flat = 0;

  for (const holding of holdings) {
    const quote = quotes[holding.id];
    if (!quote || quote.changePercent == null) continue;

    quotedCount++;
    changeSum += quote.changePercent;

    if (quote.changePercent > 0) gainers++;
    else if (quote.changePercent < 0) losers++;
    else flat++;
  }

  const avgChangePercent =
    quotedCount > 0 ? changeSum / quotedCount : null;
  const dayPnl =
    avgChangePercent != null ? totalValue * (avgChangePercent / 100) : null;

  return {
    totalValue,
    perHoldingValue,
    avgChangePercent,
    dayPnl,
    gainers,
    losers,
    flat,
    quotedCount,
    holdingCount,
  };
}

export function holdingDayPnl(
  perHoldingValue: number,
  quote: QuoteData | undefined | null,
): number | null {
  if (!quote || quote.changePercent == null) return null;
  return perHoldingValue * (quote.changePercent / 100);
}

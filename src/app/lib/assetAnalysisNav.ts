import type { NavigateFunction } from "react-router";
import type { CrowthAsset } from "../data/assets";
import { resolveAsset } from "../data/portfolioCatalog";
import { analysisFromScore, formatMarketPrice } from "./formatMarketPrice";

export type AssetAnalysisState = {
  assetId?: string;
  asset?: CrowthAsset;
};

export type AssetAnalysisTarget = {
  id: string;
  ticker: string;
  name?: string;
  /** Prefer passing the full asset so analysis never depends on catalog lookup alone. */
  asset?: CrowthAsset;
};

/** Build a navigable asset from live market fields (always ZAR display). */
export function buildMarketAsset(input: {
  id: string;
  ticker: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  changePercent?: number | null;
  changePositive?: boolean;
  aiScore?: number;
  rating?: string;
  ratingColor?: "green" | "gold" | "red";
  explanation?: string;
}): CrowthAsset {
  const existing = resolveAsset(input.id) ?? resolveAsset(input.ticker);
  const changePct = input.changePercent ?? 0;
  const aiScore = input.aiScore ?? 50;
  return {
    id: input.id,
    name: input.name || existing?.name || input.id,
    ticker: input.ticker || existing?.ticker || input.id.toUpperCase(),
    price: formatMarketPrice(input.price, input.currency ?? "ZAR", input.ticker),
    priceRaw: input.price ?? existing?.priceRaw ?? 0,
    change: `${input.changePositive !== false && changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%`,
    changePositive: input.changePositive ?? changePct >= 0,
    rating: input.rating ?? existing?.rating,
    ratingColor: input.ratingColor ?? existing?.ratingColor ?? "gold",
    aiScore,
    description: input.explanation ?? existing?.description ?? "",
    analysis: existing?.analysis ?? analysisFromScore(aiScore),
    explanation: input.explanation ?? existing?.explanation ?? "",
    chartPath:
      existing?.chartPath ?? "M0 40 C80 38 160 36 240 34 C280 32 320 30 320 28",
  };
}

/** Canonical analysis URL — always /stock/:tickerOrId, never bare /analysis. */
export function assetAnalysisPath(
  target: Pick<AssetAnalysisTarget, "id" | "ticker">,
): string {
  const key = (target.ticker || target.id).trim();
  return `/stock/${encodeURIComponent(key)}`;
}

export function assetAnalysisState(
  target: AssetAnalysisTarget,
): AssetAnalysisState {
  return {
    assetId: target.id,
    asset: target.asset,
  };
}

/** Open analysis for a specific asset. Pass `asset` whenever you have it. */
export function openAssetAnalysis(
  navigate: NavigateFunction,
  target: AssetAnalysisTarget,
): void {
  navigate(assetAnalysisPath(target), {
    state: assetAnalysisState(target),
  });
}

/**
 * Resolve which stock the analysis screen should show.
 * Never invents a default (e.g. assets[0]) — returns null if unknown.
 */
export function resolveAssetForAnalysis(
  state: AssetAnalysisState | null | undefined,
  routeSymbol: string | undefined,
): CrowthAsset | null {
  if (state?.asset?.id) {
    return state.asset;
  }

  const fromStateId = state?.assetId ? resolveAsset(state.assetId) : null;
  if (fromStateId) return fromStateId;

  if (routeSymbol) {
    const decoded = decodeURIComponent(routeSymbol).trim();
    const fromRoute = resolveAsset(decoded);
    if (fromRoute) return fromRoute;
  }

  return null;
}

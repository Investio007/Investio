/** Symbol aliases used by the Crowth frontend → Finnhub/Yahoo-style tickers */

export const SYMBOL_MAP: Record<string, string> = {
  aitech: "QQQ",
  energy: "XLE",
  crypto: "BTC-USD",
  apple: "AAPL",
  microsoft: "MSFT",
  alphabet: "GOOGL",
  tesla: "TSLA",
  amazon: "AMZN",
  nvidia: "NVDA",
  meta: "META",
  netflix: "NFLX",
  samsung: "005930.KS",
  naspers: "NPN.JO",
  sasol: "SOL.JO",
  alibaba: "BABA",
  tencent: "TCEHY",
  baidu: "BIDU",
  jd: "JD",
  nio: "NIO",
  toyota: "TM",
  sony: "SONY",
  nintendo: "NTDOY",
  infosys: "INFY",
  hdfc: "HDB",
  wipro: "WIT",
  bp: "BP",
  hsbc: "HSBC",
  shell: "SHEL",
  astrazeneca: "AZN",
  total: "TTE",
  sanofi: "SNY",
  loreal: "LRLCY",
  tencent_hk: "0700.HK",
  alibaba_hk: "9988.HK",
  hsbc_hk: "0005.HK",
  shopify: "SHOP",
  royalbank: "RY",
  tdbank: "TD",
  sap: "SAP",
  siemens: "SIEGY",
  mercedes: "MBGYY",
  skhynix: "000660.KS",
  lg: "066570.KS",
};

export const COMPARE_ASSET_IDS = [
  "apple",
  "microsoft",
  "alphabet",
  "nvidia",
  "amazon",
  "meta",
  "tesla",
  "netflix",
] as const;

export const FINNHUB_PERIOD_MAP: Record<string, { resolution: string; lookbackSec: number }> = {
  "1D": { resolution: "5", lookbackSec: 5 * 86400 },
  "1W": { resolution: "60", lookbackSec: 8 * 86400 },
  "1M": { resolution: "D", lookbackSec: 35 * 86400 },
  "6M": { resolution: "D", lookbackSec: 190 * 86400 },
  "1Y": { resolution: "W", lookbackSec: 380 * 86400 },
};

export function resolveTicker(symbol: string): string {
  const key = symbol.toLowerCase().trim();
  if (SYMBOL_MAP[key]) return SYMBOL_MAP[key];
  const upper = symbol.toUpperCase().trim();
  if (/^[A-Z0-9.\-^]{1,16}$/.test(upper)) return upper;
  throw new Error("Invalid or unsupported symbol");
}

/**
 * Currency of the *listing*, not the company's country of incorporation.
 * Finnhub profile often returns CNY for BIDU/JD ADRs that trade in USD on Nasdaq.
 */
export function listingCurrency(ticker: string, profileCurrency?: string | null): string {
  const t = ticker.toUpperCase().trim();
  if (t.endsWith(".JO")) return "ZAR";
  if (t.endsWith(".KS")) return "KRW";
  if (t.endsWith(".HK")) return "HKD";
  if (t === "BTC-USD" || t === "BTC" || t.endsWith("-USD")) return "USD";
  // Plain US tickers and ADRs (BIDU, JD, TCEHY, LRLCY, AITECH, …)
  if (/^[A-Z]{1,6}$/.test(t)) return "USD";
  const profile = (profileCurrency || "").toUpperCase().trim();
  if (profile) return profile;
  return "USD";
}

export function toFinnhubSymbol(ticker: string): { symbol: string; assetType: "stock" | "crypto" } {
  if (ticker === "BTC-USD" || ticker === "BTC") {
    return { symbol: "BINANCE:BTCUSDT", assetType: "crypto" };
  }
  // Prefer Yahoo-style suffixes — Finnhub returns zeros for KRX:/JSE:/HKEX: on many plans
  if (ticker.endsWith(".KS") || ticker.endsWith(".JO") || ticker.endsWith(".HK")) {
    return { symbol: ticker, assetType: "stock" };
  }
  return { symbol: ticker, assetType: "stock" };
}

/** Insight universe: real companies/ADRs only (no ETF/fund/crypto wrappers). */
export const INSIGHT_EXCLUDE_IDS = new Set(["aitech", "energy", "crypto"]);

/** Prefer liquid US/ADR names first so Top 20 fills even under rate limits. */
const INSIGHT_PRIORITY = [
  "baidu",
  "jd",
  "alibaba",
  "tencent",
  "nio",
  "apple",
  "microsoft",
  "alphabet",
  "nvidia",
  "amazon",
  "meta",
  "tesla",
  "netflix",
  "shopify",
  "sap",
  "bp",
  "hsbc",
  "shell",
  "astrazeneca",
  "total",
  "sanofi",
  "loreal",
  "toyota",
  "sony",
  "nintendo",
  "infosys",
  "hdfc",
  "wipro",
  "royalbank",
  "tdbank",
  "siemens",
  "mercedes",
  "samsung",
  "naspers",
  "sasol",
  "skhynix",
  "lg",
  "tencent_hk",
  "alibaba_hk",
  "hsbc_hk",
];

export const INSIGHT_ASSET_IDS = [
  ...INSIGHT_PRIORITY.filter((id) => SYMBOL_MAP[id] && !INSIGHT_EXCLUDE_IDS.has(id)),
  ...Object.keys(SYMBOL_MAP).filter(
    (k) =>
      k === k.toLowerCase() &&
      !INSIGHT_EXCLUDE_IDS.has(k) &&
      !INSIGHT_PRIORITY.includes(k),
  ),
];

/** Friendly names for insight cards (Finnhub profile often returns bare tickers). */
export const ASSET_DISPLAY_NAMES: Record<string, string> = {
  apple: "Apple Inc",
  microsoft: "Microsoft Corp",
  alphabet: "Alphabet Inc",
  tesla: "Tesla Inc",
  amazon: "Amazon.com Inc",
  nvidia: "NVIDIA Corp",
  meta: "Meta Platforms",
  netflix: "Netflix Inc",
  samsung: "Samsung Electronics",
  naspers: "Naspers",
  sasol: "Sasol",
  alibaba: "Alibaba Group",
  tencent: "Tencent Holdings",
  baidu: "Baidu Inc",
  jd: "JD.com Inc",
  nio: "NIO Inc",
  toyota: "Toyota Motor",
  sony: "Sony Group",
  nintendo: "Nintendo",
  infosys: "Infosys",
  hdfc: "HDFC Bank",
  wipro: "Wipro",
  bp: "BP",
  hsbc: "HSBC Holdings",
  shell: "Shell",
  astrazeneca: "AstraZeneca",
  total: "TotalEnergies",
  sanofi: "Sanofi",
  loreal: "L'Oréal",
  tencent_hk: "Tencent (HK)",
  alibaba_hk: "Alibaba (HK)",
  hsbc_hk: "HSBC (HK)",
  shopify: "Shopify",
  royalbank: "Royal Bank of Canada",
  tdbank: "TD Bank",
  sap: "SAP",
  siemens: "Siemens",
  mercedes: "Mercedes-Benz",
  skhynix: "SK Hynix",
  lg: "LG Electronics",
  aitech: "AI Technology ETF",
  energy: "Global Energy Fund",
  crypto: "Bitcoin",
};
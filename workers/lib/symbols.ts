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

export function toFinnhubSymbol(ticker: string): { symbol: string; assetType: "stock" | "crypto" } {
  if (ticker === "BTC-USD" || ticker === "BTC") {
    return { symbol: "BINANCE:BTCUSDT", assetType: "crypto" };
  }
  if (ticker.endsWith(".KS")) return { symbol: `KRX:${ticker.slice(0, -3)}`, assetType: "stock" };
  if (ticker.endsWith(".JO")) return { symbol: `JSE:${ticker.slice(0, -3)}`, assetType: "stock" };
  if (ticker.endsWith(".HK")) {
    const code = ticker.slice(0, -3).replace(/^0+/, "") || "0";
    return { symbol: `HKEX:${code.padStart(4, "0")}`, assetType: "stock" };
  }
  return { symbol: ticker, assetType: "stock" };
}

export const INSIGHT_ASSET_IDS = Object.keys(SYMBOL_MAP).filter((k) => k === k.toLowerCase());

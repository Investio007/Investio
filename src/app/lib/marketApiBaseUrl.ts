/** Production: same-origin /api (Vercel proxy) unless VITE_MARKET_API_URL is set. */
export function getMarketApiBaseUrl(): string {
  if (import.meta.env.DEV) return "";
  const configured = (import.meta.env.VITE_MARKET_API_URL as string | undefined)?.trim() ?? "";
  return configured.replace(/\/+$/, "");
}

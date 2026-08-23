/**
 * Same-origin /api on Vercel (vercel.json proxy) and Cloudflare Workers.
 * Direct URL only for hosts that do not serve the API themselves.
 */
export function getMarketApiBaseUrl(): string {
  if (import.meta.env.DEV) return "";

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      /\.vercel\.app$/i.test(host) ||
      /\.workers\.dev$/i.test(host) ||
      /(^|\.)crowth\./i.test(host)
    ) {
      return "";
    }
  }

  const configured = (import.meta.env.VITE_MARKET_API_URL as string | undefined)?.trim() ?? "";
  return configured.replace(/\/+$/, "");
}

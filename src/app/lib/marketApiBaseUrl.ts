/** Same-origin /api on Vercel (vercel.json proxy). Direct URL only for non-Vercel hosts. */
export function getMarketApiBaseUrl(): string {
  if (import.meta.env.DEV) return "";

  if (typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname)) {
    return "";
  }

  const configured = (import.meta.env.VITE_MARKET_API_URL as string | undefined)?.trim() ?? "";
  return configured.replace(/\/+$/, "");
}

/**
 * Cloudflare Worker: serve Crowth static assets (via Wrangler assets)
 * and proxy /api/* to the Railway FastAPI backend.
 */

export interface Env {
  ASSETS: Fetcher;
  MARKET_API_ORIGIN: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const origin = (env.MARKET_API_ORIGIN || "").replace(/\/$/, "");
      if (!origin) {
        return new Response(JSON.stringify({ error: "MARKET_API_ORIGIN not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const upstream = new URL(url.pathname + url.search, origin);
      const proxyRequest = new Request(upstream.toString(), {
        method: request.method,
        headers: request.headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        redirect: "follow",
      });

      // Avoid forwarding hop-by-hop / host headers that break upstream TLS
      proxyRequest.headers.delete("host");
      proxyRequest.headers.delete("cf-connecting-ip");
      proxyRequest.headers.delete("cf-ray");
      proxyRequest.headers.delete("cf-visitor");

      const upstreamResponse = await fetch(proxyRequest);
      return withSecurityHeaders(upstreamResponse);
    }

    // Static SPA assets (index.html fallback handled by wrangler assets config)
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;

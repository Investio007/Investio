#!/usr/bin/env node
/**
 * Automated QA smoke tests — run: node scripts/qa-smoke.mjs
 * Uses production Vercel + Railway URLs (no browser / auth required).
 */

const BASE = process.env.QA_BASE_URL || "https://investio-wheat.vercel.app";
const RAILWAY = process.env.QA_RAILWAY_URL || "https://investio-production.up.railway.app";

const routes = [
  "/",
  "/splash",
  "/auth",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
  "/home",
];

const apis = [
  { name: "health (Vercel proxy)", url: `${BASE}/api/health`, expect: /"status"\s*:\s*"ok"/ },
  { name: "health (Railway direct)", url: `${RAILWAY}/api/health`, expect: /"status"\s*:\s*"ok"/ },
  { name: "quote apple", url: `${BASE}/api/quote/apple`, expect: /"ticker"\s*:\s*"AAPL"/ },
  { name: "quote microsoft", url: `${BASE}/api/quote/microsoft`, expect: /"ticker"\s*:\s*"MSFT"/ },
  { name: "snapshot 1D", url: `${BASE}/api/snapshot/apple/1D`, expect: /"price"\s*:/ },
  { name: "insights", url: `${BASE}/api/insights`, expect: /"assets"\s*:/ },
  { name: "compare", url: `${BASE}/api/compare`, expect: /"companies"\s*:/ },
  { name: "chart 1D", url: `${BASE}/api/chart/apple/1D`, expect: /"symbol"\s*:/ },
  { name: "chart 1W", url: `${BASE}/api/chart/apple/1W`, expect: /"symbol"\s*:/ },
  { name: "chart 1M", url: `${BASE}/api/chart/apple/1M`, expect: /"symbol"\s*:/ },
  { name: "cache status", url: `${RAILWAY}/api/cache/status`, expect: /cached_keys/ },
];

const results = [];

async function checkRoute(path) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const text = await res.text();
    const pass = res.ok && (text.includes("<!DOCTYPE html") || text.includes("<html"));
    results.push({ group: "route", name: path, pass, detail: `HTTP ${res.status}` });
  } catch (e) {
    results.push({ group: "route", name: path, pass: false, detail: String(e.message) });
  }
}

async function checkApi({ name, url, expect }) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const pass = res.ok && expect.test(text);
    results.push({
      group: "api",
      name,
      pass,
      detail: pass ? `HTTP ${res.status}` : `HTTP ${res.status} — body mismatch`,
    });
  } catch (e) {
    results.push({ group: "api", name, pass: false, detail: String(e.message) });
  }
}

async function checkCors() {
  try {
    const res = await fetch(`${RAILWAY}/api/quote/apple`, {
      headers: { Origin: "https://investio-wheat.vercel.app" },
    });
    const acao = res.headers.get("access-control-allow-origin");
    const pass = acao === "https://investio-wheat.vercel.app";
    results.push({
      group: "security",
      name: "CORS allows Vercel origin",
      pass,
      detail: acao || "no ACAO header",
    });
  } catch (e) {
    results.push({ group: "security", name: "CORS allows Vercel origin", pass: false, detail: e.message });
  }
}

async function checkNoSecretsInBundle() {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dist = join(process.cwd(), "dist", "assets");
  const patterns = [/FINNHUB_API_KEY/i, /OLLAMA_API_KEY/i, /service_role/i, /sk_live_/i];
  let hit = null;
  for (const file of readdirSync(dist).filter((f) => f.endsWith(".js"))) {
    const content = readFileSync(join(dist, file), "utf8");
    for (const p of patterns) {
      if (p.test(content)) {
        hit = `${file} matched ${p}`;
        break;
      }
    }
  }
  results.push({
    group: "security",
    name: "No server secrets in dist bundle",
    pass: !hit,
    detail: hit || "clean",
  });
}

console.log(`\nInvestio QA smoke — ${BASE}\n`);

for (const path of routes) await checkRoute(path);
for (const api of apis) await checkApi(api);
await checkCors();
await checkNoSecretsInBundle();

const w = Math.max(...results.map((r) => r.name.length), 10);
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${r.name.padEnd(w)}  ${r.detail}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFailed:");
  for (const f of failed) console.log(`  - ${f.group}/${f.name}: ${f.detail}`);
  process.exit(1);
}
console.log("\nAll automated smoke checks passed.\n");

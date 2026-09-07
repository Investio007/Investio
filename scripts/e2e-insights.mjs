#!/usr/bin/env node
/**
 * End-to-end checks for Live Top 20 insights.
 * Run after deploy: node scripts/e2e-insights.mjs
 */
const BASE = process.env.QA_BASE_URL || "https://crowthza.app";
const RUNS = Number(process.env.E2E_RUNS || 5);

const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

async function runOnce(n) {
  const res = await fetch(`${BASE}/api/insights`, { cache: "no-store" });
  const body = await res.json();
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const ids = assets.map((a) => a.id);

  console.log(
    `run ${n}: HTTP ${res.status} count=${body.count} len=${assets.length} stale=${body.stale} source=${body.source} top=${ids.slice(0, 3).join(",")}`,
  );

  assert(res.ok, `run ${n}: insights HTTP ${res.status}`);
  assert(assets.length >= 15, `run ${n}: expected >=15 insights, got ${assets.length}`);
  assert(!ids.includes("aitech"), `run ${n}: aitech ETF must not appear in top 20`);
  assert(!ids.includes("energy"), `run ${n}: energy fund must not appear in top 20`);
  assert(!ids.includes("crypto"), `run ${n}: crypto must not appear in top 20`);
  assert(
    assets.every((a) => a.currency === "ZAR" && typeof a.price === "number" && a.price > 0),
    `run ${n}: every insight must be ZAR with price > 0`,
  );
  assert(
    assets.every((a) => a.id && a.ticker && a.name && a.aiScore != null),
    `run ${n}: every insight needs id/ticker/name/aiScore`,
  );

  // Spot-check top pick analysis route resolves to same id (not aitech)
  const top = assets[0];
  if (top) {
    const quoteRes = await fetch(`${BASE}/api/quote/${encodeURIComponent(top.id)}`, {
      cache: "no-store",
    });
    const quote = await quoteRes.json();
    assert(quoteRes.ok, `run ${n}: quote for top ${top.id} failed`);
    assert(
      quote.currency === "ZAR" && quote.price > 0,
      `run ${n}: top quote ${top.id} not ZAR live price`,
    );
    assert(
      String(quote.ticker || "").toUpperCase() !== "AITECH",
      `run ${n}: top quote unexpectedly AITECH`,
    );
  }
}

async function main() {
  // Warm-up (ignore) so cold rate-limit doesn't fail the suite
  try {
    await fetch(`${BASE}/api/insights`, { cache: "no-store" });
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    /* ignore */
  }

  for (let i = 1; i <= RUNS; i++) {
    try {
      await runOnce(i);
    } catch (e) {
      failures.push(`run ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (i < RUNS) await new Promise((r) => setTimeout(r, 1200));
  }

  if (failures.length) {
    console.error("\nE2E FAILED:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log(`\nE2E OK — ${RUNS} runs, top 20 healthy, no AI Technology ETF.`);
}

main();

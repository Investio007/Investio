#!/usr/bin/env node
/**
 * Regression guard: analysis must never silently fall back to assets[0]
 * (the old Baidu → AI Technology ETF bug).
 *
 * Run: node scripts/assert-asset-analysis-guard.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");

  // Forbidden: silent default to first ETF/asset on analysis screens
  if (rel.includes("StockAnalysisScreen") && /assets\s*\[\s*0\s*\]/.test(text)) {
    failures.push(
      `${rel}: must not use assets[0] as analysis fallback (wrong-stock bug)`,
    );
  }

  // Prefer shared helper — bare /analysis + assetId-only is how Baidu broke
  if (
    !rel.includes("routes.tsx") &&
    /navigate\s*\(\s*["']\/analysis["']/.test(text)
  ) {
    failures.push(
      `${rel}: use openAssetAnalysis() instead of navigate("/analysis", …)`,
    );
  }

  if (
    /navigate\s*\(\s*[`'"]\/stock\//.test(text) &&
    !rel.includes("assetAnalysisNav") &&
    !/openAssetAnalysis\s*\(/.test(text)
  ) {
    // Allow only if they also pass state with asset — still warn to use helper
    failures.push(
      `${rel}: open stock analysis via openAssetAnalysis() so id+ticker+asset travel together`,
    );
  }
}

// Catalog must resolve country stocks used on Home insights
const catalog = readFileSync(join(SRC, "app/data/portfolioCatalog.ts"), "utf8");
const country = readFileSync(join(SRC, "app/data/countryMarkets.ts"), "utf8");
const nav = readFileSync(join(SRC, "app/lib/assetAnalysisNav.ts"), "utf8");

if (!/COUNTRY_STOCKS/.test(catalog) || !/function resolveAsset/.test(catalog)) {
  failures.push("portfolioCatalog.ts must export resolveAsset including COUNTRY_STOCKS");
}
if (!/id:\s*"baidu"/.test(country) || !/ticker:\s*"BIDU"/.test(country)) {
  failures.push('countryMarkets.ts must include baidu / BIDU');
}
if (!/resolveAssetForAnalysis/.test(nav) || !/openAssetAnalysis/.test(nav)) {
  failures.push("assetAnalysisNav.ts must export openAssetAnalysis + resolveAssetForAnalysis");
}
if (!/Never invents a default/.test(nav) && !/returns null if unknown/.test(nav)) {
  failures.push("assetAnalysisNav.ts must document no silent default stock");
}

if (failures.length) {
  console.error("Asset analysis guard FAILED:\n");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("Asset analysis guard OK — no silent assets[0] fallback; nav uses openAssetAnalysis.");

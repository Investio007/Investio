/**
 * Sync mobile build env vars from .env to Ionic Appflow "Production" environment.
 *
 * Requires IONIC_TOKEN in .env or the environment (Appflow → Personal Settings →
 * Personal Access Tokens → Generate new token).
 *
 * Usage: npm run sync:appflow-env
 */

import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
const TOOLS_DIR = resolve(ROOT, "tools");

const APPFLOW_APP_ID = process.env.APPFLOW_APP_ID ?? "53b04909";
const ENVIRONMENT_NAME = process.env.APPFLOW_ENV_NAME ?? "Production";
const APPFLOW_VERSION = process.env.APPFLOW_VERSION ?? "1.3.0";

const VARIABLE_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_MARKET_API_URL",
  "VITE_AUTH_REDIRECT_URL",
  "VITE_AUTH_RESET_REDIRECT_URL",
  "VITE_SENTRY_ENVIRONMENT",
  "VITE_POSTHOG_HOST",
];

const SECRET_KEYS = [
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SENTRY_DSN",
  "VITE_POSTHOG_KEY",
  "VITE_GOOGLE_WEB_CLIENT_ID",
];

const MOBILE_OVERRIDES = {
  VITE_MARKET_API_URL: "https://investio-production.up.railway.app",
  VITE_AUTH_REDIRECT_URL: "https://localhost/auth/callback",
  VITE_AUTH_RESET_REDIRECT_URL: "https://localhost/auth/reset-password",
  VITE_SENTRY_ENVIRONMENT: "production",
  VITE_POSTHOG_HOST: "https://us.i.posthog.com",
};

function parseEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}`);
    process.exit(1);
  }
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function resolveAppflowBin() {
  const localName = process.platform === "win32" ? "appflow.exe" : "appflow";
  const localPath = join(TOOLS_DIR, localName);
  if (existsSync(localPath)) return localPath;

  for (const bin of ["appflow", "ionic-cloud"]) {
    const result = spawnSync(bin, ["--version"], {
      stdio: "pipe",
      shell: process.platform === "win32",
    });
    if (!result.error) return bin;
  }

  return null;
}

async function downloadAppflowCli() {
  mkdirSync(TOOLS_DIR, { recursive: true });
  const platform =
    process.platform === "win32"
      ? "Windows"
      : process.platform === "darwin"
        ? "Darwin"
        : "Linux";
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const fileName =
    process.platform === "win32"
      ? `appflow_${platform}_${arch}.exe`
      : `appflow_${platform}_${arch}`;
  const url = `https://cdn.ionic.io/appflow-cli/releases/${APPFLOW_VERSION}/${fileName}`;
  const dest = join(TOOLS_DIR, process.platform === "win32" ? "appflow.exe" : "appflow");

  console.log(`Downloading Appflow CLI ${APPFLOW_VERSION}...`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to download Appflow CLI (${response.status})`);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, buffer);
  if (process.platform !== "win32") {
    chmodSync(dest, 0o755);
  }
  console.log(`Installed ${dest}`);
  return dest;
}

function runAppflow(bin, args, token) {
  const fullArgs = token ? [...args, `--token=${token}`] : args;
  const result = spawnSync(bin, fullArgs, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    return 127;
  }
  return result.status ?? 1;
}

const fileEnv = parseEnvFile(ENV_PATH);
const merged = { ...fileEnv, ...MOBILE_OVERRIDES };
const token =
  process.env.IONIC_TOKEN ??
  process.env.APPFLOW_TOKEN ??
  merged.IONIC_TOKEN ??
  merged.APPFLOW_TOKEN;

if (!merged.VITE_SUPABASE_URL || !merged.VITE_SUPABASE_ANON_KEY) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env");
  process.exit(1);
}

const varLines = [];
const envArgs = [];
for (const key of VARIABLE_KEYS) {
  const value = merged[key]?.trim();
  if (!value) {
    console.warn(`Skipping missing variable: ${key}`);
    continue;
  }
  varLines.push(`${key}=${value}`);
  envArgs.push("--env", `${key}=${value}`);
}

const secretArgs = [];
for (const key of SECRET_KEYS) {
  const value = merged[key]?.trim();
  if (!value) {
    console.warn(`Skipping missing secret: ${key}`);
    continue;
  }
  secretArgs.push("--secret", `${key}=${value}`);
}

const appflowDir = resolve(ROOT, "appflow");
mkdirSync(appflowDir, { recursive: true });
const varsFilePath = resolve(appflowDir, ".production.vars.env");
writeFileSync(varsFilePath, `${varLines.join("\n")}\n`, "utf8");
console.log(`Wrote ${varsFilePath} (${varLines.length} variables)`);

if (!token) {
  console.log(`
No IONIC_TOKEN found. To auto-sync to Appflow:

1. Appflow Dashboard → Personal Settings → Personal Access Tokens → Generate new token
2. Add to .env:  IONIC_TOKEN=ion_xxxxxxxx
3. Re-run:       npm run sync:appflow-env

Or paste variables from ${varsFilePath} into Appflow → Build → Environments → Production manually.
`);
  process.exit(0);
}

let appflowBin = resolveAppflowBin();
if (!appflowBin) {
  appflowBin = await downloadAppflowCli();
}
if (!appflowBin) {
  console.error("Appflow CLI not available. Install manually or re-run this script.");
  process.exit(1);
}

const baseArgs = [
  `--app-id=${APPFLOW_APP_ID}`,
  `--name=${ENVIRONMENT_NAME}`,
  ...envArgs,
  ...secretArgs,
];

console.log(
  `\nSyncing Appflow environment "${ENVIRONMENT_NAME}" (app ${APPFLOW_APP_ID})...\n`,
);

let status = runAppflow(appflowBin, ["environment", "set", ...baseArgs], token);

if (status !== 0) {
  console.log("\nUpdate failed — trying create (environment may not exist yet)...\n");
  status = runAppflow(appflowBin, ["environment", "create", ...baseArgs], token);
}

if (status === 0) {
  console.log(
    "\n✓ Appflow environment synced. Start a new Android build with Environment: Production",
  );
} else {
  console.log(
    "\nCLI sync failed. Copy from appflow/.production.vars.env + secrets from .env into Appflow manually.",
  );
}

process.exit(status === 0 ? 0 : 1);

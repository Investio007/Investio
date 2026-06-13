/**
 * Push OAuth provider credentials from env vars to Supabase Auth config.
 * Used locally or from .github/workflows/sync-oauth-providers.yml
 *
 * Required: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
 * Optional provider secrets: GOOGLE_*, GITHUB_OAUTH_*, APPLE_*
 */

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  extractProjectRef(process.env.VITE_SUPABASE_URL);

const SITE_URL = process.env.AUTH_SITE_URL?.trim() || "http://localhost:5173";
const EXTRA_REDIRECTS = process.env.AUTH_REDIRECT_URLS?.trim() || "";

function extractProjectRef(url) {
  if (!url) return "";
  const match = url.trim().match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? "";
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

requireEnv("SUPABASE_ACCESS_TOKEN", SUPABASE_ACCESS_TOKEN);
requireEnv("SUPABASE_PROJECT_REF", PROJECT_REF);

const supabaseCallback = `https://${PROJECT_REF}.supabase.co/auth/v1/callback`;
const redirectUrls = [
  `${SITE_URL}/auth/callback`,
  ...EXTRA_REDIRECTS.split(",").map((u) => u.trim()).filter(Boolean),
];
const uriAllowList = [...new Set(redirectUrls)].join(",");

/** @type {Record<string, unknown>} */
const payload = {
  site_url: SITE_URL,
  uri_allow_list: uriAllowList,
};

function configureProvider(enabledKey, idKey, secretKey, envPrefix) {
  const clientId = process.env[`${envPrefix}_CLIENT_ID`]?.trim();
  const secret = process.env[`${envPrefix}_CLIENT_SECRET`]?.trim();

  if (clientId && secret) {
    payload[enabledKey] = true;
    payload[idKey] = clientId;
    payload[secretKey] = secret;
    console.log(`✓ ${envPrefix} credentials found — will enable`);
    return true;
  }

  console.log(`○ ${envPrefix} skipped (set ${envPrefix}_CLIENT_ID and _CLIENT_SECRET)`);
  return false;
}

const googleEnabled = configureProvider(
  "external_google_enabled",
  "external_google_client_id",
  "external_google_secret",
  "GOOGLE",
);

if (googleEnabled) {
  payload.external_google_skip_nonce_check = true;
}

configureProvider(
  "external_github_enabled",
  "external_github_client_id",
  "external_github_secret",
  "GITHUB_OAUTH",
);

configureProvider(
  "external_apple_enabled",
  "external_apple_client_id",
  "external_apple_secret",
  "APPLE",
);

const enabledCount = [
  googleEnabled,
  payload.external_github_enabled,
  payload.external_apple_enabled,
].filter(Boolean).length;

if (enabledCount === 0) {
  console.error(
    "No OAuth provider secrets found. Add at least one provider to GitHub Secrets, then re-run.",
  );
  process.exit(1);
}

console.log("\nSyncing Supabase Auth config...");
console.log(`  Project: ${PROJECT_REF}`);
console.log(`  Site URL: ${SITE_URL}`);
console.log(`  Redirect allow list: ${uriAllowList}`);
console.log(`  Supabase OAuth callback (use in Google/GitHub/Apple apps): ${supabaseCallback}\n`);

const response = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  },
);

const text = await response.text();
let body;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  body = text;
}

if (!response.ok) {
  console.error("Supabase API error:", response.status, body);
  process.exit(1);
}

console.log("OAuth providers synced to Supabase successfully.");
console.log("Test at http://localhost:5173/auth after restarting the dev server.");

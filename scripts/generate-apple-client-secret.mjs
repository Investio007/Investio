/**
 * Generate the Apple OAuth client secret (JWT) for Supabase.
 * Apple requires ES256 JWTs signed with your AuthKey .p8 file (max 180 days).
 *
 * Usage:
 *   APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_CLIENT_ID=... APPLE_PRIVATE_KEY="$(cat AuthKey_XXX.p8)" \
 *     node scripts/generate-apple-client-secret.mjs
 */

import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const MAX_VALIDITY_SECONDS = 180 * 24 * 60 * 60;

export function normalizeApplePrivateKey(value) {
  if (!value) return "";

  let key = value.trim();

  if (!key.includes("BEGIN PRIVATE KEY")) {
    try {
      key = Buffer.from(key, "base64").toString("utf8");
    } catch {
      // Keep original value; validation below will fail clearly.
    }
  }

  return key.replace(/\\n/g, "\n").trim();
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

/**
 * @param {{ teamId: string, keyId: string, clientId: string, privateKey: string }} options
 */
export function generateAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKey,
}) {
  const privateKeyPem = normalizeApplePrivateKey(privateKey);

  if (!privateKeyPem.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "APPLE_PRIVATE_KEY must be PEM (.p8) contents or base64-encoded PEM.",
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + MAX_VALIDITY_SECONDS;

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: teamId,
    iat,
    exp,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), {
    key: privateKeyPem,
    dsaEncoding: "ieee-p1363",
  });

  return {
    secret: `${unsigned}.${signature.toString("base64url")}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function runCli() {
  const teamId = readEnv("APPLE_TEAM_ID");
  const keyId = readEnv("APPLE_KEY_ID");
  const clientId = readEnv("APPLE_CLIENT_ID");
  const privateKey =
    readEnv("APPLE_PRIVATE_KEY") || readEnv("APPLE_PRIVATE_KEY_BASE64");

  if (!teamId || !keyId || !clientId || !privateKey) {
    console.error(
      "Missing env vars. Required: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY",
    );
    console.error(
      "Optional: APPLE_PRIVATE_KEY_BASE64 (base64-encoded .p8 instead of raw PEM)",
    );
    process.exit(1);
  }

  const { secret, expiresAt } = generateAppleClientSecret({
    teamId,
    keyId,
    clientId,
    privateKey,
  });

  console.log("Apple client secret generated.");
  console.log(`Expires: ${expiresAt}`);
  console.log("");
  console.log(secret);
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  runCli();
}

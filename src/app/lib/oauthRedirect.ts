import { isPasswordRecoveryFromUrl } from "./authSessionFromUrl";

/** True when the URL contains Supabase / OAuth callback parameters. */
export function hasOAuthCallbackParams(): boolean {
  if (typeof window === "undefined") return false;

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    search.has("code") ||
    hash.has("access_token") ||
    search.has("token_hash") ||
    hash.has("token_hash") ||
    search.has("token") ||
    hash.has("token") ||
    search.has("error") ||
    hash.has("error") ||
    search.has("error_description") ||
    hash.has("error_description") ||
    isPasswordRecoveryFromUrl()
  );
}

/** Keep query + hash when forwarding OAuth / email-confirm params to a route. */
export function authCallbackLocation(
  path: "/auth/callback" | "/auth/reset-password" = "/auth/callback",
): string {
  if (typeof window === "undefined") return path;
  return `${path}${window.location.search}${window.location.hash}`;
}

/** Best target for auth params that landed on `/` or another non-handler route. */
export function resolveAuthHandoffTarget(): string {
  if (isPasswordRecoveryFromUrl()) {
    return authCallbackLocation("/auth/reset-password");
  }
  return authCallbackLocation("/auth/callback");
}

export {
  getAuthCodeFromUrl,
  isPasswordRecoveryFromUrl,
} from "./authSessionFromUrl";

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
    search.has("error") ||
    hash.has("error") ||
    search.has("error_description") ||
    hash.has("error_description") ||
    isPasswordRecoveryFromUrl()
  );
}

export {
  getAuthCodeFromUrl,
  isPasswordRecoveryFromUrl,
} from "./authSessionFromUrl";

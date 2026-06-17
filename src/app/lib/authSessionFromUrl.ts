import type { Session, SupabaseClient } from "@supabase/supabase-js";

export function getUrlAuthParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return { search, hash };
}

export function isPasswordRecoveryFromUrl(): boolean {
  const { search, hash } = getUrlAuthParams();
  return search.get("type") === "recovery" || hash.get("type") === "recovery";
}

export function getAuthCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("code");
}

export function getAuthErrorFromUrl(): string | null {
  const { search, hash } = getUrlAuthParams();
  return (
    search.get("error_description") ??
    hash.get("error_description") ??
    search.get("error") ??
    hash.get("error")
  );
}

export const PENDING_RECOVERY_KEY = "investio_pending_recovery";

export function markPendingPasswordRecovery(): void {
  sessionStorage.setItem(PENDING_RECOVERY_KEY, "1");
}

export function clearPendingPasswordRecovery(): void {
  sessionStorage.removeItem(PENDING_RECOVERY_KEY);
}

export function hasPendingPasswordRecovery(): boolean {
  return sessionStorage.getItem(PENDING_RECOVERY_KEY) === "1";
}

/** Parse hash tokens, token_hash OTP, or PKCE code — in the order Supabase expects. */
export async function establishSessionFromUrl(
  client: SupabaseClient,
): Promise<{ session: Session | null; error: string | null }> {
  const { search, hash } = getUrlAuthParams();

  if (hash.has("access_token")) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const { data, error } = await client.auth.getSession();
    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      return { session: null, error: error.message };
    }
  }

  const tokenHash = search.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) {
    const otpType =
      search.get("type") === "recovery" || hash.get("type") === "recovery"
        ? "recovery"
        : "email";

    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      return { session: null, error: error.message };
    }
  }

  const code = search.get("code");
  if (code) {
    // detectSessionInUrl may have already exchanged the PKCE code — avoid double exchange.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const { data: existing } = await client.auth.getSession();
    if (existing.session) {
      return { session: existing.session, error: null };
    }

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        return { session: sessionData.session, error: null };
      }
      return { session: null, error: error.message };
    }
  }

  const { data, error } = await client.auth.getSession();
  if (data.session) {
    return { session: data.session, error: null };
  }

  return { session: null, error: error?.message ?? null };
}

export function friendlyAuthError(message: string): string {
  if (/code verifier not found/i.test(message)) {
    if (hasPendingPasswordRecovery() || isPasswordRecoveryFromUrl()) {
      return "Open the reset email in the same browser where you clicked “Send reset link” (copy the link into Chrome if the email opened elsewhere), then try again.";
    }
    return "Sign-in opened in a different browser than where you started. Open http://localhost:5173/auth in Chrome, clear site data for localhost, then try Google sign-in again in the same tab.";
  }
  if (/invalid flow state|no valid flow state|flow_state_already_used|already been used/i.test(message)) {
    return "Sign-in session expired or was already used. Go back to sign in and try again in the same browser tab (do not refresh the callback page).";
  }
  if (/no oauth code/i.test(message)) {
    return "No sign-in code in the URL. Start again from /auth in the same browser tab.";
  }
  return message;
}

export function isCodeVerifierError(message: string): boolean {
  return /code verifier not found/i.test(message);
}

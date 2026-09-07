import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";

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

export const PENDING_RECOVERY_KEY = "crowth_pending_recovery";

export function markPendingPasswordRecovery(): void {
  sessionStorage.setItem(PENDING_RECOVERY_KEY, "1");
}

export function clearPendingPasswordRecovery(): void {
  sessionStorage.removeItem(PENDING_RECOVERY_KEY);
}

export function hasPendingPasswordRecovery(): boolean {
  return sessionStorage.getItem(PENDING_RECOVERY_KEY) === "1";
}

function otpTypeFromUrl(
  search: URLSearchParams,
  hash: URLSearchParams,
): EmailOtpType {
  const raw = (search.get("type") ?? hash.get("type") ?? "email").toLowerCase();
  const allowed: EmailOtpType[] = [
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "email",
  ];
  return (allowed.includes(raw as EmailOtpType) ? raw : "email") as EmailOtpType;
}

async function waitForSession(
  client: SupabaseClient,
  attempts = 8,
  delayMs = 75,
): Promise<Session | null> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await client.auth.getSession();
    if (data.session) return data.session;
    if (i < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/** Parse hash tokens, token_hash OTP, or PKCE code — in the order Supabase expects. */
export async function establishSessionFromUrl(
  client: SupabaseClient,
): Promise<{ session: Session | null; error: string | null }> {
  const { search, hash } = getUrlAuthParams();

  if (hash.has("access_token")) {
    const access_token = hash.get("access_token") ?? "";
    const refresh_token = hash.get("refresh_token") ?? "";
    if (access_token) {
      const { data, error } = await client.auth.setSession({
        access_token,
        refresh_token,
      });
      if (data.session) {
        return { session: data.session, error: null };
      }
      if (error) {
        // detectSessionInUrl may still finish exchanging
        const raced = await waitForSession(client, 6, 50);
        if (raced) return { session: raced, error: null };
        return { session: null, error: error.message };
      }
    }
  }

  const tokenHash = search.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpTypeFromUrl(search, hash),
    });

    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      return { session: null, error: error.message };
    }
  }

  // Legacy email links sometimes use `token` + `type` (+ email) instead of `token_hash`
  const legacyToken = search.get("token") ?? hash.get("token");
  const legacyEmail = search.get("email") ?? hash.get("email");
  if (legacyToken && legacyEmail && !search.get("code")) {
    const { data, error } = await client.auth.verifyOtp({
      email: legacyEmail,
      token: legacyToken,
      type: otpTypeFromUrl(search, hash),
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
    // detectSessionInUrl may already be exchanging — give it a moment
    const existing = await waitForSession(client, 6, 40);
    if (existing) {
      return { session: existing, error: null };
    }

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      const sessionData = await waitForSession(client, 4, 50);
      if (sessionData) {
        return { session: sessionData, error: null };
      }
      return { session: null, error: error.message };
    }
  }

  const session = await waitForSession(client, 3, 40);
  if (session) {
    return { session, error: null };
  }

  return { session: null, error: null };
}

/** Exchange PKCE code (or hash tokens) from a native OAuth callback URL. */
export async function establishSessionFromCallbackUrl(
  client: SupabaseClient,
  callbackUrl: string,
): Promise<{ session: Session | null; error: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { session: null, error: "Invalid callback URL." };
  }

  const authError =
    parsed.searchParams.get("error_description") ??
    parsed.searchParams.get("error");
  if (authError) {
    return { session: null, error: authError };
  }

  const code = parsed.searchParams.get("code");
  if (code) {
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

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  if (hash.has("access_token")) {
    const { data, error } = await client.auth.setSession({
      access_token: hash.get("access_token") ?? "",
      refresh_token: hash.get("refresh_token") ?? "",
    });
    if (data.session) {
      return { session: data.session, error: null };
    }
    if (error) {
      return { session: null, error: error.message };
    }
  }

  const { data, error } = await client.auth.getSession();
  if (data.session) {
    return { session: data.session, error: null };
  }

  return { session: null, error: error?.message ?? "No auth code in callback URL." };
}

export function friendlyAuthError(message: string): string {
  if (/code verifier not found|both auth code and code verifier/i.test(message)) {
    if (hasPendingPasswordRecovery() || isPasswordRecoveryFromUrl()) {
      return "Open the reset email in the same browser where you clicked “Send reset link” (copy the link into this browser if the email opened elsewhere), then try again.";
    }
    return "Your email is confirmed. Sign in with your email and password in this browser tab.";
  }
  if (/invalid flow state|no valid flow state|flow_state_already_used|already been used/i.test(message)) {
    return "This confirmation link was already used or expired. Sign in with your email and password, or request a new link.";
  }
  if (/no oauth code/i.test(message)) {
    return "No sign-in code in the URL. Start again from /auth in the same browser tab.";
  }
  if (/otp_expired|token has expired|email link is invalid/i.test(message)) {
    return "This email link has expired. Sign up again or request a new confirmation email.";
  }
  return message;
}

export function isCodeVerifierError(message: string): boolean {
  return /code verifier not found|both auth code and code verifier/i.test(message);
}

/** True when the callback URL looks like an email confirm / magic link (not OAuth-only). */
export function looksLikeEmailConfirmCallback(): boolean {
  const { search, hash } = getUrlAuthParams();
  const type = (search.get("type") ?? hash.get("type") ?? "").toLowerCase();
  if (["signup", "email", "magiclink", "invite", "email_change"].includes(type)) {
    return true;
  }
  return Boolean(
    search.get("token_hash") ||
      hash.get("token_hash") ||
      search.get("token") ||
      hash.get("token"),
  );
}

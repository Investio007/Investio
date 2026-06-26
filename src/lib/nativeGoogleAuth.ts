import {
  SocialLogin,
  type GoogleLoginOptions,
  type GoogleLoginResponseOnline,
} from "@capgo/capacitor-social-login";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

export function getGoogleWebClientId(): string | undefined {
  return (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined)?.trim();
}

/** True when native Google Sign-In (in-app account picker) is available. */
export function isNativeGoogleAuthAvailable(): boolean {
  return Boolean(getGoogleWebClientId());
}

function randomNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function decodeJwtPayload(token: string): { nonce?: string } | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let initialized = false;

async function ensureInitialized(webClientId: string): Promise<void> {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: "online",
    },
  });
  initialized = true;
}

export async function signInWithGoogleNative(
  client: SupabaseClient,
): Promise<{ error: AuthError | null }> {
  const webClientId = getGoogleWebClientId();
  if (!webClientId) {
    return {
      error: { message: "Google Web Client ID is not configured." } as AuthError,
    };
  }

  try {
    await ensureInitialized(webClientId);

    const rawNonce = randomNonce();
    const nonceDigest = await sha256Hex(rawNonce);

    const response = await SocialLogin.login({
      provider: "google",
      options: {
        nonce: nonceDigest,
      } as GoogleLoginOptions,
    });

    if (response.result.responseType !== "online") {
      return {
        error: { message: "Unexpected Google response. Try again." } as AuthError,
      };
    }

    const googleResult = response.result as GoogleLoginResponseOnline;
    const idToken = googleResult.idToken;
    if (!idToken) {
      return {
        error: { message: "Could not get Google ID token." } as AuthError,
      };
    }

    const decoded = decodeJwtPayload(idToken);
    const { error } = await client.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      ...(decoded?.nonce ? { nonce: rawNonce } : {}),
    });

    if (error) return { error };
    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google sign-in failed.";
    return { error: { message } as AuthError };
  }
}

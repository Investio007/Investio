import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { getAuthRedirectUrl } from "./supabase";
import { establishSessionFromCallbackUrl } from "../app/lib/authSessionFromUrl";

type OAuthProvider = "google" | "apple";

const CALLBACK_PATH = "/auth/callback";

function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === CALLBACK_PATH || url.includes(CALLBACK_PATH);
  } catch {
    return url.includes(CALLBACK_PATH);
  }
}

function toAppPath(callbackUrl: string): string {
  const parsed = new URL(callbackUrl);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Handle cold-start deep links (app opened from OAuth redirect). */
export function registerMobileAuthDeepLinkHandler(): void {
  void App.addListener("appUrlOpen", (event) => {
    if (!isAuthCallbackUrl(event.url)) return;
    void Browser.close();
    window.location.replace(toAppPath(event.url));
  });
}

export async function signInWithOAuthNative(
  client: SupabaseClient,
  provider: OAuthProvider,
): Promise<{ error: AuthError | null }> {
  const redirectTo = getAuthRedirectUrl();
  if (!redirectTo) {
    return {
      error: { message: "Auth redirect URL is not configured." } as AuthError,
    };
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) return { error };
  if (!data?.url) {
    return {
      error: { message: "Could not start sign in." } as AuthError,
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = (result: { error: AuthError | null }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      void listener.then((handle) => handle.remove());
      resolve(result);
    };

    const listener = App.addListener("appUrlOpen", async (event) => {
      if (!isAuthCallbackUrl(event.url)) return;

      await Browser.close();

      const { session, error: sessionError } = await establishSessionFromCallbackUrl(
        client,
        event.url,
      );

      if (sessionError) {
        finish({ error: { message: sessionError } as AuthError });
        return;
      }

      if (!session) {
        finish({
          error: { message: "Sign-in did not complete. Try again." } as AuthError,
        });
        return;
      }

      if (session.user.email) {
        localStorage.setItem(
          "investio_user",
          JSON.stringify({ email: session.user.email }),
        );
      }

      finish({ error: null });
    });

    void Browser.open({ url: data.url, presentationStyle: "popover" });

    timeoutId = window.setTimeout(() => {
      finish({
        error: {
          message: "Sign-in timed out. Close the browser and try again.",
        } as AuthError,
      });
    }, 120_000);
  });
}

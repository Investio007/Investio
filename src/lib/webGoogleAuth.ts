import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { getGoogleWebClientId } from "./nativeGoogleAuth";

type CredentialResponse = { credential?: string };

type PromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (listener?: (notification: PromptNotification) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let gsiLoading: Promise<void> | null = null;

function loadGsiClient(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In is only available in the browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoading) return gsiLoading;

  gsiLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-In.")),
      );
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  }).finally(() => {
    gsiLoading = null;
  });

  return gsiLoading;
}

async function generateNonce(): Promise<[string, string]> {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  );
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce),
  );
  const hashedNonce = Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return [nonce, hashedNonce];
}

function removeGoogleChooserUi(root: HTMLElement | null) {
  window.google?.accounts.id.cancel();
  root?.remove();
}

/**
 * Google Identity Services on the app origin (crowthza.app / localhost).
 * Avoids Supabase's …supabase.co redirect host on the account chooser.
 */
export async function signInWithGoogleWeb(
  client: SupabaseClient,
): Promise<{ error: AuthError | null }> {
  const clientId = getGoogleWebClientId();
  if (!clientId) {
    return {
      error: {
        message: "Google Web Client ID is not configured.",
      } as AuthError,
    };
  }

  try {
    await loadGsiClient();
    if (!window.google?.accounts?.id) {
      return {
        error: { message: "Google Sign-In failed to initialize." } as AuthError,
      };
    }

    const [nonce, hashedNonce] = await generateNonce();

    return await new Promise<{ error: AuthError | null }>((resolve) => {
      let settled = false;
      const overlay = document.createElement("div");
      overlay.setAttribute("data-crowth-google-chooser", "1");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(10,31,68,0.45);padding:24px;";

      const panel = document.createElement("div");
      panel.style.cssText =
        "background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.18);text-align:center;";
      panel.innerHTML =
        '<p style="margin:0 0 8px;font:600 16px/1.3 system-ui,sans-serif;color:#0A1F44">Continue with Google</p>' +
        '<p style="margin:0 0 16px;font:13px/1.4 system-ui,sans-serif;color:#4B5563">Choose your account to sign in to Crowth</p>';

      const buttonHost = document.createElement("div");
      buttonHost.style.cssText =
        "display:flex;justify-content:center;min-height:44px;";
      panel.appendChild(buttonHost);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText =
        "margin-top:16px;border:0;background:transparent;color:#6B7280;font:14px system-ui,sans-serif;cursor:pointer;";
      panel.appendChild(cancelBtn);
      overlay.appendChild(panel);

      const finish = (result: { error: AuthError | null }) => {
        if (settled) return;
        settled = true;
        removeGoogleChooserUi(overlay);
        resolve(result);
      };

      cancelBtn.onclick = () =>
        finish({
          error: { message: "Google sign-in cancelled." } as AuthError,
        });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          finish({
            error: { message: "Google sign-in cancelled." } as AuthError,
          });
        }
      });

      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: CredentialResponse) => {
          const credential = response.credential;
          if (!credential) {
            finish({
              error: {
                message: "Could not get Google ID token.",
              } as AuthError,
            });
            return;
          }
          const { error } = await client.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce,
          });
          finish({ error });
        },
        nonce: hashedNonce,
        context: "signin",
        ux_mode: "popup",
        use_fedcm_for_prompt: true,
      });

      document.body.appendChild(overlay);

      window.google!.accounts.id.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 300,
        logo_alignment: "left",
      });

      // Prefer FedCM / One Tap when the browser allows it (no supabase host).
      window.google!.accounts.id.prompt((notification) => {
        if (
          notification.isNotDisplayed() ||
          notification.isSkippedMoment() ||
          notification.isDismissedMoment()
        ) {
          // Keep the in-page Google button as the free branded path.
          return;
        }
      });
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google sign-in failed.";
    return { error: { message } as AuthError };
  }
}

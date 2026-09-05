import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    /** Injected by Cloudflare Worker from secrets when Vite build vars are missing */
    __CROWTH_ENV__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_ANON_KEY?: string;
      VITE_GOOGLE_WEB_CLIENT_ID?: string;
    };
  }
}

function readPublicEnv(
  name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY",
): string | undefined {
  const fromVite = (import.meta.env[name] as string | undefined)?.trim();
  if (fromVite) return fromVite;
  if (typeof window !== "undefined") {
    return window.__CROWTH_ENV__?.[name]?.trim();
  }
  return undefined;
}

const supabaseUrl = readPublicEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readPublicEnv("VITE_SUPABASE_ANON_KEY");

const PLACEHOLDER_PATTERN = /your_|placeholder|paste_/i;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("https://") &&
    !PLACEHOLDER_PATTERN.test(supabaseUrl) &&
    !PLACEHOLDER_PATTERN.test(supabaseAnonKey),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "crowth-auth",
      },
    })
  : null;

export function getAuthRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const configured = (
    import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  )?.trim();
  if (configured) return configured;
  return `${window.location.origin}/auth/callback`;
}

export function getPasswordResetRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const configured = (
    import.meta.env.VITE_AUTH_RESET_REDIRECT_URL as string | undefined
  )?.trim();
  if (configured) return configured;
  return `${window.location.origin}/auth/reset-password`;
}

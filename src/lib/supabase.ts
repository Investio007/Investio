import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

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
        storageKey: "investio-auth",
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

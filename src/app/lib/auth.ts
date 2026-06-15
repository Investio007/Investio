/** Session flag for local dev demo (never enabled in production builds). */
export const DEMO_SESSION_KEY = "investio_demo_session";

export function isDemoSessionActive(): boolean {
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "1";
}

export function enableDemoSession(): void {
  sessionStorage.setItem(DEMO_SESSION_KEY, "1");
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

/** Demo bypass is only available in Vite dev (`npm run dev`). */
export function isDevDemoAllowed(): boolean {
  return import.meta.env.DEV;
}

export function isAuthenticatedSession(
  hasSupabaseUser: boolean,
): boolean {
  if (hasSupabaseUser) return true;
  return isDevDemoAllowed() && isDemoSessionActive();
}

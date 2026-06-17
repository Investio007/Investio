import * as Sentry from "@sentry/react";

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();

export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() ||
      import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    dataCollection: {},
  });

  if (import.meta.env.DEV) {
    (window as Window & { Sentry?: typeof Sentry }).Sentry = Sentry;
  }
}

export { Sentry };

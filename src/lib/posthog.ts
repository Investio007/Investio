import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): typeof posthog | null {
  const key = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim();
  if (!key || initialized) {
    return initialized ? posthog : null;
  }

  const apiHost =
    (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() ||
    "https://us.i.posthog.com";

  posthog.init(key, {
    api_host: apiHost,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });

  initialized = true;
  return posthog;
}

export function getPostHog(): typeof posthog | null {
  return initialized ? posthog : null;
}

export { posthog };

import { getPostHog } from "./posthog";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export function captureEvent(event: string, properties?: AnalyticsProps): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture(event, properties);
}

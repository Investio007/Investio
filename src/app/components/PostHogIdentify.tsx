import { useEffect } from "react";
import { useInvestio } from "../context/InvestioContext";
import { getPostHog } from "../../lib/posthog";

/** Tie PostHog persons to Supabase user ids when signed in. */
export function PostHogIdentify() {
  const { user } = useInvestio();

  useEffect(() => {
    const client = getPostHog();
    if (!client) return;

    if (user?.id) {
      client.identify(user.id, {
        email: user.email ?? undefined,
      });
      return;
    }

    client.reset();
  }, [user?.id, user?.email]);

  return null;
}

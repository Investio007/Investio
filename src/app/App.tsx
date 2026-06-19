import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { GlobalToast } from "./components/GlobalToast";
import { getPostHog } from "../lib/posthog";
import { isCapacitorNative } from "../lib/capacitorPlatform";
import { registerMobileAuthDeepLinkHandler } from "../lib/mobileOAuth";

export default function App() {
  useEffect(() => {
    if (isCapacitorNative()) {
      registerMobileAuthDeepLinkHandler();
    }
  }, []);

  useEffect(() => {
    const client = getPostHog();
    if (!client) return;

    const capturePageview = () => {
      client.capture("$pageview", {
        $current_url: window.location.href,
      });
    };

    capturePageview();
    return router.subscribe(capturePageview);
  }, []);

  return (
    <div className="app-root min-h-dvh h-dvh w-full max-w-[100vw] bg-white flex flex-col overflow-hidden">
      <div
        id="investio-phone-root"
        className="flex-1 min-h-0 overflow-hidden relative flex flex-col w-full"
      >
        <RouterProvider router={router} />
        <GlobalToast />
      </div>
    </div>
  );
}

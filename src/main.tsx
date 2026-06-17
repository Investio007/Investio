
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import App from "./app/App.tsx";
import { PostHogIdentify } from "./app/components/PostHogIdentify.tsx";
import { InvestioProvider } from "./app/context/InvestioContext";
import { initPostHog } from "./lib/posthog";
import { initSentry, Sentry } from "./lib/sentry";
import "./styles/index.css";

initSentry();
const posthogClient = initPostHog();

function SentryFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-6 text-center">
      <div>
        <p className="text-[#0A1F44] font-semibold text-lg mb-2">Something went wrong</p>
        <p className="text-gray-600 text-sm mb-4">
          The error was reported automatically. Try refreshing the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/home")}
          className="text-[#0A1F44] font-medium text-sm underline"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

function AppTree() {
  return (
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <InvestioProvider>
        <PostHogIdentify />
        <App />
      </InvestioProvider>
    </Sentry.ErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  posthogClient ? (
    <PostHogProvider client={posthogClient}>
      <AppTree />
    </PostHogProvider>
  ) : (
    <AppTree />
  ),
);

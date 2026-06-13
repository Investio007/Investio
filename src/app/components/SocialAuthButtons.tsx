import { Button } from "./ui/button";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  loadingProvider?: "google" | "apple" | null;
  onGoogleClick: () => void;
  onAppleClick: () => void;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M17.05 20.28c-.98.95-2.05 1.88-3.71 1.88-1.66 0-2.19-.98-4.08-.98-1.89 0-2.48.96-4.04.98-1.57.02-2.77-1.42-3.75-2.37C2.79 15.25 1.94 11.21 3.66 8.7c.86-1.24 2.36-2.03 3.94-2.05 1.55-.03 3.01 1.04 3.97 1.04.96 0 2.76-1.28 4.66-1.09.79.03 3.01.32 4.43 2.41-3.7 2.01-3.1 7.18.62 8.87-.52 1.36-1.2 2.72-2.02 3.4zM14.03 3.5c.73-.89 1.23-2.13 1.09-3.36-1.05.04-2.32.7-3.08 1.59-.68.79-1.28 2.05-1.12 3.26 1.18.09 2.39-.6 3.11-1.49z" />
    </svg>
  );
}

export function SocialAuthButtons({
  disabled = false,
  loadingProvider = null,
  onGoogleClick,
  onAppleClick,
}: SocialAuthButtonsProps) {
  const isBusy = disabled || loadingProvider !== null;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={isBusy}
        onClick={onGoogleClick}
        className="w-full h-14 rounded-2xl bg-white border-gray-200 text-[#0A1F44] hover:bg-[#F5F7FA] text-base font-medium"
      >
        <GoogleIcon />
        {loadingProvider === "google" ? "Connecting..." : "Continue with Google"}
      </Button>

      <Button
        type="button"
        disabled={isBusy}
        onClick={onAppleClick}
        className="w-full h-14 rounded-2xl bg-black hover:bg-black/90 text-white text-base font-medium"
      >
        <AppleIcon />
        {loadingProvider === "apple" ? "Connecting..." : "Continue with Apple"}
      </Button>
    </div>
  );
}

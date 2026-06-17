import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { PasswordInput } from "../components/PasswordInput";
import {
  clearPendingPasswordRecovery,
  establishSessionFromUrl,
  friendlyAuthError,
  getAuthErrorFromUrl,
  isPasswordRecoveryFromUrl,
} from "../lib/authSessionFromUrl";
import { updatePassword } from "../services/supabaseDb";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { MIN_PASSWORD_LENGTH } from "../lib/authConstants";

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      navigate("/auth", { replace: true });
      return;
    }

    const client = supabase;
    const authError = getAuthErrorFromUrl();
    if (authError) {
      setError(friendlyAuthError(authError));
      setVerifying(false);
      return;
    }

    let mounted = true;
    let finished = false;

    const run = async () => {
      const { session, error: sessionError } = await establishSessionFromUrl(client);
      if (!mounted || finished) return;

      if (session) {
        finished = true;
        clearPendingPasswordRecovery();
        setSessionReady(true);
        setVerifying(false);
        window.history.replaceState({}, document.title, "/auth/reset-password");
        return;
      }

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted || finished) return;
        if (
          (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
          nextSession
        ) {
          finished = true;
          clearPendingPasswordRecovery();
          setSessionReady(true);
          setVerifying(false);
          window.history.replaceState({}, document.title, "/auth/reset-password");
        }
      });

      if (sessionError) {
        subscription.unsubscribe();
        finished = true;
        setError(friendlyAuthError(sessionError));
        setVerifying(false);
        return;
      }

      const timeout = window.setTimeout(() => {
        subscription.unsubscribe();
        if (!mounted || finished) return;
        finished = true;
        setError(
          isPasswordRecoveryFromUrl()
            ? "This reset link is invalid or has expired. Request a new one and open it in the same browser."
            : "This reset link is invalid or has expired. Request a new one from the sign-in page.",
        );
        setVerifying(false);
      }, 20000);

      return () => {
        subscription.unsubscribe();
        window.clearTimeout(timeout);
      };
    };

    let cleanup: (() => void) | undefined;

    void run().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
        return;
      }

      clearPendingPasswordRecovery();
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-2">
        Choose a new password
      </h1>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
        Use at least {MIN_PASSWORD_LENGTH} characters. You will stay signed in
        after saving.
      </p>

      {verifying ? (
        <p className="text-gray-600 text-sm">Verifying reset link...</p>
      ) : error && !sessionReady ? (
        <div className="text-center">
          <p className="text-[#E03A3E] text-sm mb-4" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth/forgot-password", { replace: true })}
            className="text-[#0A1F44] font-medium"
          >
            Request a new link
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <p className="text-[#E03A3E] text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-[#0A1F44]">
              New password
            </Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[#0A1F44]">
              Confirm password
            </Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-12 sm:h-14 rounded-2xl text-base sm:text-lg"
          >
            {loading ? "Saving..." : "Save new password"}
          </Button>
        </form>
      )}
    </AuthPageLayout>
  );
}

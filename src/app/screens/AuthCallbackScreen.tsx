import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import {
  establishSessionFromUrl,
  friendlyAuthError,
  getAuthErrorFromUrl,
  hasPendingPasswordRecovery,
  isCodeVerifierError,
  isPasswordRecoveryFromUrl,
} from "../lib/authSessionFromUrl";

export function AuthCallbackScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      navigate("/auth", { replace: true });
      return;
    }

    const client = supabase;
    const authError = getAuthErrorFromUrl();
    if (authError) {
      setError(friendlyAuthError(authError));
      return;
    }

    if (isPasswordRecoveryFromUrl()) {
      const suffix = `${window.location.search}${window.location.hash}`;
      navigate(`/auth/reset-password${suffix}`, { replace: true });
      return;
    }

    let mounted = true;

    const run = async () => {
      const { session, error: sessionError } = await establishSessionFromUrl(client);
      if (!mounted) return;

      if (sessionError && isCodeVerifierError(sessionError)) {
        if (hasPendingPasswordRecovery()) {
          const suffix = `${window.location.search}${window.location.hash}`;
          navigate(`/auth/reset-password${suffix}`, { replace: true });
          return;
        }
        setError(friendlyAuthError(sessionError));
        return;
      }

      if (sessionError) {
        setError(friendlyAuthError(sessionError));
        return;
      }

      if (!session) {
        setError(
          friendlyAuthError(
            "Sign in timed out. Clear localhost site data and try again in the same browser tab.",
          ),
        );
        return;
      }

      if (session.user.email) {
        localStorage.setItem(
          "investio_user",
          JSON.stringify({ email: session.user.email }),
        );
      }

      window.history.replaceState({}, document.title, "/auth/callback");

      if (isPasswordRecoveryFromUrl() || hasPendingPasswordRecovery()) {
        navigate("/auth/reset-password", { replace: true });
        return;
      }

      navigate("/home", { replace: true });
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <AuthPageLayout>
      {error ? (
        <div className="text-center w-full">
          <p className="text-[#E03A3E] text-sm sm:text-base mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/auth", { replace: true })}
            className="touch-target text-[#0A1F44] font-medium text-sm sm:text-base"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <p className="text-gray-600 text-sm sm:text-base text-center">
          Completing sign in...
        </p>
      )}
    </AuthPageLayout>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import {
  establishSessionFromUrl,
  friendlyAuthError,
  getAuthErrorFromUrl,
  getAuthCodeFromUrl,
  hasPendingPasswordRecovery,
  isCodeVerifierError,
  isPasswordRecoveryFromUrl,
  looksLikeEmailConfirmCallback,
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
    let mounted = true;

    const goSignIn = (notice: string) => {
      navigate("/auth", { replace: true, state: { notice, preferLogin: true } });
    };

    const run = async () => {
      const authError = getAuthErrorFromUrl();
      if (authError) {
        if (/flow_state_already_used|already been used/i.test(authError)) {
          const { data } = await client.auth.getSession();
          if (!mounted) return;
          if (data.session) {
            window.history.replaceState({}, document.title, "/auth/callback");
            navigate("/home", { replace: true });
            return;
          }
          goSignIn(
            "Your email is already confirmed. Sign in with your email and password.",
          );
          return;
        }
        setError(friendlyAuthError(authError));
        return;
      }

      if (isPasswordRecoveryFromUrl()) {
        const suffix = `${window.location.search}${window.location.hash}`;
        navigate(`/auth/reset-password${suffix}`, { replace: true });
        return;
      }

      const hadAuthParams =
        Boolean(getAuthCodeFromUrl()) || looksLikeEmailConfirmCallback();

      const { session, error: sessionError } = await establishSessionFromUrl(client);
      if (!mounted) return;

      if (sessionError && isCodeVerifierError(sessionError)) {
        if (hasPendingPasswordRecovery()) {
          const suffix = `${window.location.search}${window.location.hash}`;
          navigate(`/auth/reset-password${suffix}`, { replace: true });
          return;
        }
        // Email confirm often succeeds server-side even when PKCE verifier is missing
        // (temp-mail / different browser / multiple signup tabs).
        goSignIn(friendlyAuthError(sessionError));
        return;
      }

      if (sessionError) {
        setError(friendlyAuthError(sessionError));
        return;
      }

      if (!session) {
        if (hadAuthParams || looksLikeEmailConfirmCallback()) {
          goSignIn(
            "Your email is confirmed. Sign in with your email and password.",
          );
          return;
        }
        goSignIn(
          "Sign-in link expired or was opened incorrectly. Sign in here, or open the email link once in this same browser.",
        );
        return;
      }

      if (session.user.email) {
        localStorage.setItem(
          "crowth_user",
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

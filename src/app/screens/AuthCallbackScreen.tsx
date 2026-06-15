import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { TrendingUp } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function getAuthErrorFromUrl() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    query.get("error_description") ??
    hash.get("error_description") ??
    query.get("error") ??
    hash.get("error")
  );
}

function friendlyAuthError(message: string) {
  if (/code verifier not found/i.test(message)) {
    return "Sign-in opened in a different browser than where you started. Open http://localhost:5173/auth in Chrome (not the IDE preview), clear site data for localhost, then try again.";
  }
  if (/invalid flow state|no valid flow state/i.test(message)) {
    return "Sign-in session expired or was interrupted. Go back to sign in and try Google again in the same Chrome tab.";
  }
  return message;
}

export function AuthCallbackScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      navigate("/auth", { replace: true });
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;

    const client = supabase;
    const authError = getAuthErrorFromUrl();
    if (authError) {
      setError(friendlyAuthError(authError));
      return;
    }

    let mounted = true;
    let finished = false;

    const complete = (session: { user: { email?: string | null } } | null, message?: string) => {
      if (!mounted || finished) return;

      if (message) {
        finished = true;
        setError(friendlyAuthError(message));
        return;
      }

      if (!session) return;

      finished = true;

      if (session.user.email) {
        localStorage.setItem(
          "investio_user",
          JSON.stringify({ email: session.user.email }),
        );
      }

      window.history.replaceState({}, document.title, "/auth/callback");
      navigate("/home", { replace: true });
    };

    // detectSessionInUrl exchanges the PKCE code once when this page loads.
    client.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (session) {
        complete(session);
        return;
      }
      if (sessionError) {
        complete(null, sessionError.message);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        complete(session);
      }
    });

    const timeout = window.setTimeout(async () => {
      if (finished || !mounted) return;

      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (session) {
        complete(session);
        return;
      }

      complete(
        null,
        sessionError?.message ??
          "Sign in was cancelled or failed. Use the same Chrome tab you started from.",
      );
    }, 8000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-full bg-white flex flex-col items-center justify-center px-8">
      <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl flex items-center justify-center mb-6">
        <TrendingUp className="w-7 h-7 text-white" />
      </div>

      {error ? (
        <div className="text-center max-w-sm">
          <p className="text-[#E03A3E] text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/auth", { replace: true })}
            className="text-[#0A1F44] font-medium"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <p className="text-gray-600 text-sm">Completing sign in...</p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { TrendingUp } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export function AuthCallbackScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      navigate("/auth", { replace: true });
      return;
    }

    let mounted = true;

    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      const authError =
        new URLSearchParams(window.location.search).get("error_description") ??
        new URLSearchParams(window.location.hash.slice(1)).get("error_description");

      if (authError) {
        if (mounted) setError(authError);
        return;
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (mounted) setError(exchangeError.message);
          return;
        }
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        if (mounted) setError("Sign in was cancelled or failed. Please try again.");
        return;
      }

      if (session.user.email) {
        localStorage.setItem(
          "investio_user",
          JSON.stringify({ email: session.user.email }),
        );
      }

      navigate("/home", { replace: true });
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
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

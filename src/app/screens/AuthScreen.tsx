import { useState } from "react";
import { useNavigate } from "react-router";
import { TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  signInWithEmail,
  signInWithOAuth,
  signUpWithEmail,
  type OAuthProvider,
} from "../services/supabaseDb";

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const navigate = useNavigate();

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Connect Supabase in .env to use Google sign in.");
      return;
    }

    setOauthLoading(provider);

    try {
      const { error: oauthError } = await signInWithOAuth(provider);
      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        if (isLogin) {
          const { error: signInError } = await signInWithEmail(email, password);
          if (signInError) {
            setError(signInError.message);
            return;
          }
        } else {
          const { data, error: signUpError } = await signUpWithEmail(
            email,
            password,
          );
          if (signUpError) {
            setError(signUpError.message);
            return;
          }
          if (data.user && !data.session) {
            setError(
              "Check your email to confirm your account, then sign in.",
            );
            return;
          }
        }
        localStorage.setItem("investio_user", JSON.stringify({ email }));
        navigate("/home");
        return;
      }

      // Offline demo mode when Supabase env vars are missing
      if (isLogin) {
        const stored = localStorage.getItem("investio_user");
        if (!stored) {
          setError("No account found. Please sign up first.");
          return;
        }
        navigate("/home");
        return;
      }

      localStorage.setItem("investio_user", JSON.stringify({ email }));
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full min-h-0 bg-white flex flex-col px-8 py-12 overflow-y-auto">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <span className="text-2xl font-bold text-[#0A1F44]">Investio</span>
      </div>

      <div className="flex-1">
        <h1 className="text-3xl font-bold text-[#0A1F44] mb-2">
          {isLogin ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-gray-600 mb-8">
          {isLogin
            ? "Sign in to sync your demo portfolio to the cloud"
            : "Start learning to invest today"}
        </p>

        {!isSupabaseConfigured && (
          <p className="text-xs text-[#FFB612] bg-[#FFB612]/10 rounded-xl p-3 mb-4">
            Supabase is not connected yet. Add your project URL and anon key to
            `.env`, then restart the app. Google sign in requires Supabase —
            until then, use email or demo mode below.
          </p>
        )}

        {error && (
          <div style={{ color: "#E03A3E", fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}

        <SocialAuthButtons
          disabled={loading}
          loadingProvider={oauthLoading === "google" ? "google" : null}
          onGoogleClick={() => handleOAuth("google")}
        />

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-500">
              or {isLogin ? "sign in" : "sign up"} with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#0A1F44]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44] placeholder:text-gray-400"
              required
              disabled={loading || oauthLoading !== null}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#0A1F44]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44] placeholder:text-gray-400"
              required
              disabled={loading || oauthLoading !== null}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-14 rounded-2xl text-lg mt-8"
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-gray-600 hover:text-[#0A1F44]"
              disabled={loading || oauthLoading !== null}
            >
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <span className="font-medium text-[#0A1F44]">
                {isLogin ? "Sign Up" : "Sign In"}
              </span>
            </button>
          </div>
        </form>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/home")}
          className="w-full h-12 rounded-2xl border-[#0A1F44]/20 text-[#0A1F44] mt-6"
        >
          Continue in demo mode
        </Button>

        <div className="mt-8 p-4 bg-[#F5F7FA] rounded-2xl">
          <p className="text-xs text-[#1F2937] text-center leading-relaxed">
            Investio is an AI investment analysis platform. This app does not
            hold funds, execute trades, or manage real investments. All
            portfolio values are simulations for educational purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

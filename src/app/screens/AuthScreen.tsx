import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { PasswordInput } from "../components/PasswordInput";
import { SignUpLegalConsent } from "../components/SignUpLegalConsent";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import {
  signInWithEmail,
  signInWithOAuth,
  signUpWithEmail,
  type OAuthProvider,
} from "../services/supabaseDb";
import { isSupabaseConfigured } from "../../lib/supabase";
import { MIN_PASSWORD_LENGTH } from "../lib/authConstants";

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const navigate = useNavigate();

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    setNotice("");

    if (!isSupabaseConfigured) {
      setError("Connect Supabase in .env to use social sign in.");
      return;
    }

    setOauthLoading(provider);

    try {
      const { error: oauthError } = await signInWithOAuth(provider);
      if (oauthError) {
        if (/cancel/i.test(oauthError.message)) return;
        setError(oauthError.message);
        return;
      }
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isLogin && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (!isSupabaseConfigured) {
      setError("Supabase is required for sign in. Configure .env to continue.");
      return;
    }

    setLoading(true);

    try {
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
          setNotice(
            "Check your email to confirm your account, then sign in.",
          );
          setIsLogin(true);
          setPassword("");
          return;
        }
      }
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || oauthLoading !== null;

  return (
    <AuthPageLayout>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-1.5">
        {isLogin ? "Welcome back" : "Log in or sign up"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {isLogin
          ? "Sign in to sync your demo portfolio"
          : "Learn to invest with AI guidance — practice, no real money"}
      </p>

      {!isSupabaseConfigured && (
        <p className="text-xs text-[#FFB612] bg-[#FFB612]/10 rounded-xl p-3 mb-4">
          Supabase is not connected yet. Add your project URL and anon key to
          `.env`, then restart the app.
        </p>
      )}

      {error && (
        <p className="text-xs text-[#E03A3E] mb-3" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-[#0A1F44] bg-[#0A1F44]/8 rounded-xl p-3 mb-4">
          {notice}
        </p>
      )}

      {/* Social first — ChatGPT pattern */}
      <SocialAuthButtons
        disabled={busy}
        loadingProvider={oauthLoading}
        onGoogleClick={() => handleOAuth("google")}
        onAppleClick={() => handleOAuth("apple")}
      />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400 uppercase tracking-wide">
            or
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          id="email"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-2xl bg-white border border-gray-200 text-base text-[#0A1F44] placeholder:text-gray-400 focus-visible:ring-[#0A1F44]/20"
          required
          disabled={busy}
          autoComplete="email"
        />

        <PasswordInput
          id="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          autoComplete={isLogin ? "current-password" : "new-password"}
          className="h-12 rounded-2xl bg-white border border-gray-200 text-base text-[#0A1F44] placeholder:text-gray-400 pr-12 focus-visible:ring-[#0A1F44]/20"
        />

        <SignUpLegalConsent />

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-12 rounded-2xl text-base font-medium mt-1"
        >
          {loading
            ? "Please wait..."
            : isLogin
              ? "Log in"
              : "Continue"}
        </Button>

        {/* DeepSeek-style secondary links */}
        <div className="flex items-center justify-between pt-1 text-sm">
          {isLogin && isSupabaseConfigured ? (
            <Link
              to="/auth/forgot-password"
              className="text-[#0A1F44] hover:underline"
            >
              Forgot password?
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setNotice("");
            }}
            className="text-[#0A1F44] font-medium hover:underline"
            disabled={busy}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </div>
      </form>

      <p className="mt-8 text-[10px] text-gray-400 text-center leading-relaxed">
        Demo portfolios only. Crowth does not hold funds or execute trades.
      </p>
    </AuthPageLayout>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const navigate = useNavigate();

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Connect Supabase in .env to use social sign in.");
      return;
    }

    setOauthLoading(provider);

    try {
      const { error: oauthError } = await signInWithOAuth(provider);
      if (oauthError) {
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
          setError(
            "Check your email to confirm your account, then sign in.",
          );
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

  return (
    <AuthPageLayout
      footer={
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-[#F5F7FA] rounded-2xl">
          <p className="text-[11px] sm:text-xs text-[#1F2937] text-center leading-relaxed">
            Investio is an AI investment analysis platform. This app does not
            hold funds, execute trades, or manage real investments. All
            portfolio values are simulations for educational purposes.
          </p>
        </div>
      }
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-2">
        {isLogin ? "Welcome back" : "Create account"}
      </h1>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
        {isLogin
          ? "Sign in to sync your demo portfolio to the cloud"
          : "Start learning to invest today"}
      </p>

      {!isSupabaseConfigured && (
        <p className="text-xs text-[#FFB612] bg-[#FFB612]/10 rounded-xl p-3 mb-4">
          Supabase is not connected yet. Add your project URL and anon key to
          `.env`, then restart the app. Google sign in requires Supabase.
        </p>
      )}

      {error && (
        <div style={{ color: "#E03A3E", fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {!isLogin && (
        <div className="mb-4 p-3 sm:p-4 bg-[#F5F7FA] rounded-2xl">
          <SignUpLegalConsent actionLabel="Continue with Google" />
        </div>
      )}

      <SocialAuthButtons
        disabled={loading}
        loadingProvider={oauthLoading}
        onGoogleClick={() => handleOAuth("google")}
        onAppleClick={() => handleOAuth("apple")}
      />

      <div className="relative my-6 sm:my-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-gray-500">
            or {isLogin ? "sign in" : "sign up"} with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
            className="h-12 sm:h-14 rounded-2xl bg-[#F5F7FA] border-0 text-base text-[#0A1F44] placeholder:text-gray-400"
            required
            disabled={loading || oauthLoading !== null}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-[#0A1F44]">
              Password
            </Label>
            {isLogin && isSupabaseConfigured && (
              <Link
                to="/auth/forgot-password"
                className="text-xs font-medium text-[#0A1F44] hover:underline shrink-0"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading || oauthLoading !== null}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </div>

        {!isLogin && (
          <div className="pt-1">
            <SignUpLegalConsent actionLabel="Sign Up" />
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || oauthLoading !== null}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-12 sm:h-14 rounded-2xl text-base sm:text-lg mt-4 sm:mt-6"
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
    </AuthPageLayout>
  );
}

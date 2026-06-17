import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { requestPasswordReset } from "../services/supabaseDb";
import { isSupabaseConfigured } from "../../lib/supabase";
import { markPendingPasswordRecovery } from "../lib/authSessionFromUrl";

const COOLDOWN_KEY = "investio_reset_cooldown";
const COOLDOWN_MS = 60_000;

function secondsUntilCooldownEnds(): number {
  const raw = sessionStorage.getItem(COOLDOWN_KEY);
  if (!raw) return 0;
  const remaining = Number(raw) - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(secondsUntilCooldownEnds);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      const next = secondsUntilCooldownEnds();
      setCooldown(next);
      if (next <= 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter the email for your account.");
      return;
    }

    if (cooldown > 0) {
      setError(`Please wait ${cooldown}s before requesting another reset link.`);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await requestPasswordReset(trimmed);

      if (resetError) {
        if (/rate limit|too many/i.test(resetError.message)) {
          setError(resetError.message);
          return;
        }
      }

      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
      markPendingPasswordRecovery();
      setCooldown(COOLDOWN_MS / 1000);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      header={
        <button
          type="button"
          onClick={() => navigate("/auth", { replace: true })}
          className="touch-target flex items-center gap-2 text-[#0A1F44] mb-4 sm:mb-6 self-start -mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to sign in</span>
        </button>
      }
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-2">Reset password</h1>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
        {sent
          ? "If an account exists for that email, we sent a reset link. Open it in this same browser (copy the link from your email into Chrome if needed)."
          : "Enter your email and we will send you a link to reset your password."}
      </p>

      {error && (
        <p className="text-[#E03A3E] text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {sent ? (
        <div className="space-y-6">
          <p className="text-sm text-gray-600 bg-[#F5F7FA] rounded-2xl p-4">
            Did not get it? Check spam, or wait{" "}
            {cooldown > 0 ? `${cooldown}s` : "a moment"} and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSent(false);
              setError("");
            }}
            disabled={cooldown > 0}
            className="w-full h-12 rounded-2xl border-[#0A1F44]/20 text-[#0A1F44]"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Send another link"}
          </Button>
          <Link
            to="/auth"
            className="block text-center text-sm font-medium text-[#0A1F44]"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-[#0A1F44]">
              Email
            </Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 sm:h-14 rounded-2xl bg-[#F5F7FA] border-0 text-base text-[#0A1F44] placeholder:text-gray-400"
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-12 sm:h-14 rounded-2xl text-base sm:text-lg"
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthPageLayout>
  );
}

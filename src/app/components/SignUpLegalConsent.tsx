import { Link } from "react-router";

type SignUpLegalConsentProps = {
  actionLabel?: "Sign Up" | "Continue with Google";
};

const policyLinkClass =
  "text-[#0A1F44] font-medium underline underline-offset-2 hover:text-[#0A1F44]/80";

export function SignUpLegalConsent({
  actionLabel = "Sign Up",
}: SignUpLegalConsentProps) {
  return (
    <div className="text-[11px] sm:text-xs text-gray-600 leading-relaxed space-y-2">
      <p>
        By tapping {actionLabel}, you agree to create an account and to
        Investio{" "}
        <Link to="/legal/terms" className={policyLinkClass}>
          Terms of Service
        </Link>
        ,{" "}
        <Link to="/legal/privacy" className={policyLinkClass}>
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/legal/cookies" className={policyLinkClass}>
          Cookies Policy
        </Link>
        .
      </p>
      <p>
        The Privacy Policy describes the ways we can use the information we
        collect when you create an account. For example, we use this information
        to provide, personalize and improve our products, including ads.
      </p>
    </div>
  );
}

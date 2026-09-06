import { Link } from "react-router";

const policyLinkClass =
  "text-[#0A1F44] font-medium underline underline-offset-2 hover:text-[#0A1F44]/80";

/** Single-line consent (DeepSeek-style) — keeps Terms / Privacy / Cookies links. */
export function SignUpLegalConsent() {
  return (
    <p className="text-[11px] sm:text-xs text-gray-500 text-center leading-relaxed">
      By continuing, you agree to Crowth{" "}
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
  );
}

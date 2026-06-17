export type LegalPolicyId = "terms" | "privacy" | "cookies";

export type LegalPolicy = {
  id: LegalPolicyId;
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

export const LEGAL_POLICIES: Record<LegalPolicyId, LegalPolicy> = {
  terms: {
    id: "terms",
    title: "Terms of Service",
    updated: "June 2026",
    sections: [
      {
        heading: "Educational use only",
        body: "Investio is an educational platform for learning about investing. It does not hold funds, execute trades, or provide personalised financial advice. All portfolio values and balances are simulations for learning purposes.",
      },
      {
        heading: "Your account",
        body: "You are responsible for keeping your sign-in details secure. You must provide accurate information when creating an account and notify us if you suspect unauthorised access.",
      },
      {
        heading: "Acceptable use",
        body: "Do not misuse the service, attempt to disrupt our systems, or use Investio in violation of applicable laws. We may suspend accounts that abuse the platform.",
      },
      {
        heading: "Changes",
        body: "We may update these terms from time to time. Continued use of Investio after changes are posted means you accept the updated terms.",
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    updated: "June 2026",
    sections: [
      {
        heading: "Information we collect",
        body: "When you create an account we collect your email address and authentication data through our identity provider (Supabase). If you sign in with Google, we receive basic profile information allowed by that sign-in.",
      },
      {
        heading: "How we use information",
        body: "We use this information to provide, secure, and improve Investio — for example to sync your demo portfolio, save your preferences, and keep you signed in. We do not sell your personal information.",
      },
      {
        heading: "Storage & security",
        body: "Account and portfolio data are stored in encrypted cloud infrastructure. Market data requests may include technical logs (such as IP address) on our backend for reliability and abuse prevention.",
      },
      {
        heading: "Your choices",
        body: "You can sign out at any time or request account deletion by contacting the project owner. Local demo data in your browser can be cleared via your browser settings.",
      },
    ],
  },
  cookies: {
    id: "cookies",
    title: "Cookies Policy",
    updated: "June 2026",
    sections: [
      {
        heading: "What we use",
        body: "Investio uses browser storage (including local storage and session storage) to keep you signed in, remember your demo portfolios, and complete secure sign-in flows (PKCE). These are essential for the app to work.",
      },
      {
        heading: "Third parties",
        body: "If you use Google sign-in, Google may set its own cookies during authentication. Our hosting providers (for example Vercel) may use technical cookies for performance and security.",
      },
      {
        heading: "Managing cookies",
        body: "You can clear site data for Investio in your browser settings. Clearing storage will sign you out and remove locally saved demo data until you sign in again.",
      },
    ],
  },
};

export function isLegalPolicyId(value: string): value is LegalPolicyId {
  return value === "terms" || value === "privacy" || value === "cookies";
}

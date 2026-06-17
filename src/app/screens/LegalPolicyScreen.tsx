import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AuthPageLayout } from "../components/AuthPageLayout";
import {
  isLegalPolicyId,
  LEGAL_POLICIES,
  type LegalPolicyId,
} from "../content/legalPolicies";

export function LegalPolicyScreen() {
  const navigate = useNavigate();
  const { policyId } = useParams<{ policyId: string }>();

  if (!policyId || !isLegalPolicyId(policyId)) {
    return (
      <AuthPageLayout>
        <p className="text-gray-600 text-sm">Policy not found.</p>
        <Link to="/auth" className="text-[#0A1F44] font-medium text-sm mt-4 inline-block">
          Back to sign in
        </Link>
      </AuthPageLayout>
    );
  }

  const policy = LEGAL_POLICIES[policyId as LegalPolicyId];

  return (
    <AuthPageLayout
      header={
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-2 text-[#0A1F44] mb-4 sm:mb-6 self-start -mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
      }
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-1">
        {policy.title}
      </h1>
      <p className="text-xs text-gray-500 mb-6">Last updated: {policy.updated}</p>

      <div className="space-y-5">
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-sm font-semibold text-[#0A1F44] mb-1.5">
              {section.heading}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {(["terms", "privacy", "cookies"] as LegalPolicyId[]).map((id) => (
          <Link
            key={id}
            to={`/legal/${id}`}
            className={`font-medium ${
              id === policyId
                ? "text-gray-400 pointer-events-none"
                : "text-[#0A1F44] hover:underline"
            }`}
          >
            {LEGAL_POLICIES[id].title}
          </Link>
        ))}
      </div>
    </AuthPageLayout>
  );
}

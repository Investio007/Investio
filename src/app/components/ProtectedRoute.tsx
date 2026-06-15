import { Navigate, Outlet } from "react-router";
import { useInvestio } from "../context/InvestioContext";
import { isSupabaseConfigured } from "../../lib/supabase";
import { isAuthenticatedSession } from "../lib/auth";

export function ProtectedRoute() {
  const { user, authLoading } = useInvestio();

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 border-2 border-[#0A1F44] border-t-transparent rounded-full animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (isAuthenticatedSession(Boolean(user))) {
    return <Outlet />;
  }

  if (isSupabaseConfigured && !user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to="/auth" replace />;
}

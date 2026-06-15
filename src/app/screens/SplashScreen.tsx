import { useEffect } from "react";
import { useNavigate } from "react-router";
import { TrendingUp } from "lucide-react";
import { useInvestio } from "../context/InvestioContext";

export function SplashScreen() {
  const navigate = useNavigate();
  const { user, authLoading } = useInvestio();

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      navigate("/home", { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      navigate("/onboarding");
    }, 2500);

    return () => clearTimeout(timer);
  }, [authLoading, navigate, user]);

  return (
    <div className="h-full min-h-dvh bg-[#0A1F44] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
          <TrendingUp className="w-12 h-12 text-[#0A1F44]" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Investio</h1>
          <p className="text-white/80 text-lg">Invest Smarter</p>
        </div>
      </div>
    </div>
  );
}

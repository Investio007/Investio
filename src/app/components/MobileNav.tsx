import { useNavigate, useLocation } from "react-router";
import { Home, BarChart3, GitCompare, MessageSquare } from "lucide-react";

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const isAdvisorActive =
    location.pathname === "/ai-assistant" || location.pathname === "/advisor";

  return (
    <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom z-40 rounded-b-[2rem]">
      <div className="flex justify-around items-center">
        <button
          onClick={() => navigate("/home")}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isActive("/home") ? "bg-[#0A1F44]" : "bg-gray-100"
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                isActive("/home") ? "text-white" : "text-gray-600"
              }`}
            />
          </div>
          <span
            className={`text-xs font-medium ${
              isActive("/home") ? "text-[#0A1F44]" : "text-gray-600"
            }`}
          >
            Home
          </span>
        </button>
        <button
          onClick={() => navigate("/portfolio-builder")}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isActive("/portfolio-builder") ? "bg-[#0A1F44]" : "bg-gray-100"
            }`}
          >
            <BarChart3
              className={`w-5 h-5 ${
                isActive("/portfolio-builder") ? "text-white" : "text-gray-600"
              }`}
            />
          </div>
          <span
            className={`text-xs ${
              isActive("/portfolio-builder")
                ? "text-[#0A1F44] font-medium"
                : "text-gray-600"
            }`}
          >
            Portfolio
          </span>
        </button>
        <button
          onClick={() => navigate("/compare")}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isActive("/compare") ? "bg-[#0A1F44]" : "bg-gray-100"
            }`}
          >
            <GitCompare
              className={`w-5 h-5 ${
                isActive("/compare") ? "text-white" : "text-gray-600"
              }`}
            />
          </div>
          <span
            className={`text-xs ${
              isActive("/compare")
                ? "text-[#0A1F44] font-medium"
                : "text-gray-600"
            }`}
          >
            Compare
          </span>
        </button>
        <button
          onClick={() => navigate("/advisor")}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isAdvisorActive ? "bg-[#0A1F44]" : "bg-gray-100"
            }`}
          >
            <MessageSquare
              className={`w-5 h-5 ${
                isAdvisorActive ? "text-white" : "text-gray-600"
              }`}
            />
          </div>
          <span
            className={`text-xs ${
              isAdvisorActive
                ? "text-[#0A1F44] font-medium"
                : "text-gray-600"
            }`}
          >
            AI Advisor
          </span>
        </button>
      </div>
    </div>
  );
}
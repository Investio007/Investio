import { useNavigate, useLocation } from "react-router";
import { Home, BarChart3, GitCompare, MessageSquare } from "lucide-react";

const navItems = [
  { path: "/home", label: "Home", icon: Home, isActive: (path: string) => path === "/home" },
  {
    path: "/portfolio-builder",
    label: "Portfolio",
    icon: BarChart3,
    isActive: (path: string) => path === "/portfolio-builder",
  },
  {
    path: "/compare",
    label: "Compare",
    icon: GitCompare,
    isActive: (path: string) => path === "/compare",
  },
  {
    path: "/advisor",
    label: "AI Advisor",
    icon: MessageSquare,
    isActive: (path: string) =>
      path === "/ai-assistant" || path === "/advisor",
  },
] as const;

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="shrink-0 bg-white border-t border-gray-200 px-2 py-2 safe-area-bottom z-40">
      <div className="flex justify-around items-stretch">
        {navItems.map(({ path, label, icon: Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
              aria-current={active ? "page" : undefined}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  active ? "bg-[#0A1F44]" : "bg-gray-100"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-white" : "text-gray-600"}`}
                />
              </div>
              <span
                className={`text-xs leading-tight ${
                  active ? "text-[#0A1F44] font-medium" : "text-gray-600"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

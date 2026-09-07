import { Outlet, useLocation } from "react-router";
import { MobileNav } from "./MobileNav";

export function AppShell() {
  const { pathname } = useLocation();
  const isChat =
    pathname === "/advisor" || pathname === "/ai-assistant";

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={
          isChat
            ? "flex-1 min-h-0 overflow-hidden flex flex-col"
            : "flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide touch-pan-y [-webkit-overflow-scrolling:touch]"
        }
      >
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}

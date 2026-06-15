import { Outlet } from "react-router";
import { MobileNav } from "./MobileNav";

export function AppShell() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}

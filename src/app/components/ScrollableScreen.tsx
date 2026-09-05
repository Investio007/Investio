import type { ReactNode } from "react";
import { Outlet } from "react-router";

/**
 * Full-height scroll region for protected screens that sit under
 * the locked app viewport (h-dvh + overflow-hidden).
 */
export function ScrollableScreen({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide touch-pan-y [-webkit-overflow-scrolling:touch] ${className}`}
    >
      {children ?? <Outlet />}
    </div>
  );
}

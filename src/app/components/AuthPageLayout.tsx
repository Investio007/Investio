import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";

type AuthPageLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function AuthPageLayout({ children, header, footer }: AuthPageLayoutProps) {
  return (
    <div className="h-dvh min-h-dvh w-full max-w-[100vw] bg-white flex flex-col overflow-hidden safe-area-top safe-area-bottom">
      <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        <div className="min-h-full w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-5 sm:py-8 md:py-12">
          <div className="w-full max-w-full sm:max-w-md md:max-w-lg flex flex-col">
            {header}

            <div className="flex items-center gap-2.5 sm:gap-3 mb-6 sm:mb-8 md:mb-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0A1F44] rounded-2xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-[#0A1F44]">
                Investio
              </span>
            </div>

            <div className="w-full">{children}</div>

            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

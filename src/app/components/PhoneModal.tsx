import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { getPhoneRoot } from "../lib/phonePortal";

type PhoneModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function PhoneModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: PhoneModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const container = getPhoneRoot();
  if (!container) return null;

  return createPortal(
    <div className="absolute inset-0 z-[80] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-modal-title"
        className="relative z-10 w-full max-w-[min(340px,calc(100%-2rem))] max-h-[min(80dvh,100%)] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="touch-target absolute top-3 right-3 w-10 h-10 rounded-full bg-[#F5F7FA] flex items-center justify-center text-gray-500 hover:text-[#0A1F44]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h2
          id="phone-modal-title"
          className="text-lg font-semibold text-[#0A1F44] pr-8"
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    container,
  );
}

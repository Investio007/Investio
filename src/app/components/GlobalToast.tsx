import { useInvestio } from "../context/InvestioContext";

export function GlobalToast() {
  const { toast } = useInvestio();

  if (!toast.visible) return null;

  return (
    <div
      role="status"
      className="absolute bottom-[4.75rem] left-1/2 -translate-x-1/2 z-[60] max-w-[90%] bg-[#0A1F44] text-white px-5 py-2.5 rounded-full text-[13px] shadow-lg text-center pointer-events-none"
    >
      {toast.message}
    </div>
  );
}

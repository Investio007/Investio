import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn(
          "h-12 sm:h-14 rounded-2xl bg-[#F5F7FA] border-0 text-base text-[#0A1F44] placeholder:text-gray-400 pr-12",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((show) => !show)}
        disabled={disabled}
        className="touch-target absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-500 hover:text-[#0A1F44] disabled:opacity-50"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <EyeOff className="w-5 h-5" aria-hidden />
        ) : (
          <Eye className="w-5 h-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

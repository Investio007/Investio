import { useEffect, useState } from "react";

export const PHONE_ROOT_ID = "investio-phone-root";

export function getPhoneRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(PHONE_ROOT_ID);
}

export function usePhonePortalContainer(): HTMLElement | undefined {
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);

  useEffect(() => {
    setContainer(getPhoneRoot() ?? undefined);
  }, []);

  return container;
}

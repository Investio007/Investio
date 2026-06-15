import { useEffect, useState } from "react";

/**
 * Extra bottom padding when the on-screen keyboard shrinks the visual viewport
 * (common on Android Chrome and Capacitor WebViews).
 */
export function useVisualViewportPadding() {
  const [paddingBottom, setPaddingBottom] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const keyboardOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setPaddingBottom(keyboardOffset);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return paddingBottom;
}

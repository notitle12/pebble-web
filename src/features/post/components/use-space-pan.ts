"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/** Space temporarily pans the active canvas; text inputs keep normal typing. */
export function useSpacePan(viewport: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const pressed = useRef(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const release = () => { pressed.current = false; setActive(false); };
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      const element = target instanceof Element ? target : null;
      if (element?.closest("input,textarea,select,button,a,[role=textbox]") || (element instanceof HTMLElement && element.isContentEditable)) return;
      const view = viewport.current;
      if (!view || (!view.contains(element) && !view.matches(":hover"))) return;
      event.preventDefault();
      event.stopPropagation();
      pressed.current = true;
      setActive(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") release();
    };
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      pressed.current = false;
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, viewport]);
  return { pressed, active };
}

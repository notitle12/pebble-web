"use client";

import { useEffect, useRef, useState } from "react";

/** Expand the existing editor DOM so drafts, selection and undo history survive. */
export function useEditorFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let wasActive = false;
    const sync = () => {
      const active = document.fullscreenElement === ref.current;
      setExpanded(active);
      if (wasActive && !active && !document.fullscreenElement) buttonRef.current?.focus({ preventScroll: true });
      wasActive = active;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement !== ref.current) return;
      event.preventDefault();
      event.stopPropagation();
      void document.exitFullscreen().catch(() => setError("전체화면을 종료하지 못했습니다. 종료 버튼을 눌러 주세요."));
    };
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("keydown", escape, true);
    };
  }, []);

  const toggle = async () => {
    setError("");
    try {
      if (document.fullscreenElement === ref.current) {
        await document.exitFullscreen();
      } else if (ref.current?.requestFullscreen) {
        await ref.current.requestFullscreen();
      } else {
        setError("이 브라우저에서는 전체화면을 지원하지 않습니다.");
      }
    } catch {
      setError("전체화면을 전환하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return { ref, buttonRef, expanded, error, toggle };
}

export function EditorFullscreenButton({ control }: { control: ReturnType<typeof useEditorFullscreen> }) {
  return <><button ref={control.buttonRef} className="editor-fullscreen-button architecture-auto-layout" type="button"
    aria-label={control.expanded ? "편집기 전체화면 종료" : "편집기 전체화면"}
    aria-pressed={control.expanded} onClick={control.toggle}>
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d={control.expanded ? "M3 9h6V3m12 6h-6V3M3 15h6v6m12-6h-6v6" : "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"}/>
    </svg>
    {control.expanded ? "전체화면 종료" : "전체화면"}
  </button>{control.error && <span role="alert">{control.error}</span>}</>;
}

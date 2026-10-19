"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function DiagramLightbox({
  label,
  triggerText,
  children,
  open: controlled,
  onOpenChange,
  hideTrigger = false,
}: {
  hideTrigger?: boolean;
  label: string;
  triggerText?: string;
  children: () => ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlled ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open) {
      dialog?.showModal();
    } else if (dialog?.open) {
      dialog.close();
    }
  }, [open]);

  // 다이어그램 라이트박스가 열려있는 동안 바깥 페이지 배경 스크롤을 방지
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [open]);

  // 휠 조작 시 이벤트가 바깥 윈도우/페이지로 전파되어 바깥이 움직이지 않도록 차단
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
    };
    dialog.addEventListener("wheel", handleWheel, { passive: true });
    return () => dialog.removeEventListener("wheel", handleWheel);
  }, [open]);

  return (
    <>
      {!hideTrigger && (
        <button type="button" className="button diagram-expand" onClick={() => setOpen(true)}>
          {triggerText ?? "확대"}
        </button>
      )}
      <dialog
        ref={ref}
        className="diagram-lightbox"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <header>
          <h2 id={titleId}>{label}</h2>
          <button
            type="button"
            className="diagram-lightbox-close"
            aria-label={`${label} 닫기`}
            title="닫기"
            autoFocus
            onClick={() => setOpen(false)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        {open && children()}
      </dialog>
    </>
  );
}

"use client";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type KeyboardEvent } from "react";
import { clampDiagramWidth, resizedDiagramWidth } from "../diagram-width";
import styles from "./diagram-width-frame.module.css";

type Props = { width?: number | null; editable?: boolean; onCommit?: (width: number) => void; children: ReactNode };
type Drag = { pointerId: number; startX: number; startWidth: number; containerWidth: number };

export function DiagramWidthFrame({ width, editable = false, onCommit, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const current = clampDiagramWidth(preview ?? width ?? 100);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (!editable || event.button !== 0) return;
    const containerWidth = root.current?.clientWidth ?? 0;
    if (!containerWidth) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: current, containerWidth };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPreview(resizedDiagramWidth(active.startWidth, event.clientX - active.startX, active.containerWidth));
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    const next = cancel ? active.startWidth : resizedDiagramWidth(active.startWidth, event.clientX - active.startX, active.containerWidth);
    setPreview(null);
    if (!cancel && next !== active.startWidth) onCommit?.(next);
  };
  const keyResize = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editable || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    onCommit?.(clampDiagramWidth(current + (event.key === "ArrowRight" ? 5 : -5)));
  };
  return <div ref={root} className={styles.root}>
    <div className={styles.frame} style={{ "--diagram-width": `${current}%` } as CSSProperties}>
      {children}
      {editable && <button type="button" className={styles.handle} aria-label="다이어그램 너비 조절" title="드래그하거나 좌우 방향키로 너비 조절" onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onKeyDown={keyResize}><span aria-hidden="true"/></button>}
    </div>
  </div>;
}

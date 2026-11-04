"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./image-editor.module.css";
import { clampCropRect, safeBitmapSize, type CropOperation } from "../image-edit-model";

export type ImageEditorProps = {
  src: string;
  fileName?: string;
  onApply: (file: File) => Promise<void>;
  onCancel: () => void;
};

type CropSelection = { startX: number; startY: number; endX: number; endY: number };

function cropBounds(selection: CropSelection, width: number, height: number): CropOperation | null {
  return clampCropRect(selection.startX, selection.startY, selection.endX, selection.endY, { width, height });
}

function replayCropHistory(source: ImageBitmap, operations: CropOperation[], cursor: number): HTMLCanvasElement {
  let current = document.createElement("canvas");
  current.width = source.width;
  current.height = source.height;
  current.getContext("2d")!.drawImage(source, 0, 0);
  for (const operation of operations.slice(0, cursor)) {
    const next = document.createElement("canvas");
    next.width = operation.width;
    next.height = operation.height;
    next.getContext("2d")!.drawImage(current, operation.x, operation.y, operation.width, operation.height, 0, 0, operation.width, operation.height);
    current.width = 0;
    current.height = 0;
    current = next;
  }
  return current;
}

export function ImageEditor({ src, fileName = "image", onApply, onCancel }: ImageEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadError, setLoadError] = useState("");
  const [operations, setOperations] = useState<CropOperation[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<CropSelection | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const displayRef = useRef<HTMLCanvasElement>(null);
  const workingRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const latestRef = useRef({ saving, onCancel });
  latestRef.current = { saving, onCancel };

  useEffect(() => {
    setMounted(true);
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(src, { mode: "cors", credentials: "omit", signal: controller.signal });
        if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다 (${response.status}).`);
        const decoded = await createImageBitmap(await response.blob());
        if (!active) { decoded.close(); return; }
        if (!safeBitmapSize(decoded.width, decoded.height)) {
          decoded.close();
          throw new Error("이미지 크기는 한 변 8,000px, 총 2,000만 픽셀까지 편집할 수 있습니다.");
        }
        bitmapRef.current = decoded;
        setBitmap(decoded);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setLoadError(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
      bitmapRef.current?.close();
      bitmapRef.current = null;
      if (workingRef.current) { workingRef.current.width = 0; workingRef.current.height = 0; }
      workingRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [src]);

  useEffect(() => {
    if (mounted) dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [mounted]);

  const redraw = useCallback(() => {
    if (!bitmap || !displayRef.current) return;
    const working = replayCropHistory(bitmap, operations, cursor);
    if (workingRef.current) { workingRef.current.width = 0; workingRef.current.height = 0; }
    workingRef.current = working;
    setCanvasSize({ width: working.width, height: working.height });
    const display = displayRef.current;
    display.width = working.width;
    display.height = working.height;
    display.getContext("2d")!.drawImage(working, 0, 0);
  }, [bitmap, operations, cursor]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && dialogRef.current) {
        const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key !== "Escape" || latestRef.current.saving) return;
      event.preventDefault();
      latestRef.current.onCancel();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const addCrop = () => {
    if (!selection || !workingRef.current) return;
    const crop = cropBounds(selection, workingRef.current.width, workingRef.current.height);
    if (!crop) { setNotice("자르기 영역을 조금 더 크게 선택하세요."); return; }
    setOperations(previous => [...previous.slice(0, cursor), crop]);
    setCursor(cursor + 1);
    setSelection(null);
    setPointerStart(null);
    setNotice("자르기를 적용했습니다. 실행 취소로 되돌릴 수 있습니다.");
  };

  const undo = () => { setCursor(value => Math.max(0, value - 1)); setSelection(null); setNotice(""); };
  const redo = () => { setCursor(value => Math.min(operations.length, value + 1)); setSelection(null); setNotice(""); };

  const pointerCoordinates = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = displayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / Math.max(1, rect.height))),
    };
  };
  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!workingRef.current || saving) return;
    const point = pointerCoordinates(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerStart(point);
    setSelection({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
    setNotice("");
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart) return;
    const point = pointerCoordinates(event);
    if (point) setSelection({ startX: pointerStart.x, startY: pointerStart.y, endX: point.x, endY: point.y });
  };
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart) return;
    const point = pointerCoordinates(event);
    if (point) setSelection({ startX: pointerStart.x, startY: pointerStart.y, endX: point.x, endY: point.y });
    setPointerStart(null);
  };

  const apply = async () => {
    const canvas = workingRef.current;
    if (!canvas || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("이미지를 내보내지 못했습니다.")), "image/png"));
      await onApply(new File([blob], `${fileName.replace(/\.[^.]+$/, "")}-edited.png`, { type: "image/png", lastModified: Date.now() }));
      setSaving(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "이미지 저장에 실패했습니다.");
      setSaving(false);
    }
  };

  if (!mounted) return null;
  const current = workingRef.current;
  const bounds = selection && current ? cropBounds(selection, current.width, current.height) : null;
  return createPortal(<div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel(); }}>
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="image-editor-title" aria-describedby="image-editor-help" tabIndex={-1}>
      <header className={styles.header}>
        <div><h2 id="image-editor-title">이미지 편집</h2><p id="image-editor-help">자르기 영역을 드래그해 선택하고 적용하세요. 원본은 편집 중 보존됩니다.</p></div>
        <button type="button" className="editor-action" onClick={onCancel} disabled={saving}>닫기</button>
      </header>
      {loadError ? <div className={styles.error} role="alert">{loadError}</div> : !bitmap ? <p className={styles.status} role="status">이미지를 불러오는 중…</p> : <>
        <div className={styles.stage} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setPointerStart(null)}>
          <canvas ref={displayRef} className={styles.canvas} aria-label="편집할 이미지" />
          {bounds && current && <div className={styles.cropMarquee} aria-hidden="true" style={{ left: `${bounds.x / current.width * 100}%`, top: `${bounds.y / current.height * 100}%`, width: `${bounds.width / current.width * 100}%`, height: `${bounds.height / current.height * 100}%` }} />}
        </div>
        <div className={styles.toolbar}>
          <div className={styles.actions}>
            <button type="button" className="editor-action" onClick={undo} disabled={cursor === 0 || saving}>실행 취소</button>
            <button type="button" className="editor-action" onClick={redo} disabled={cursor >= operations.length || saving}>다시 실행</button>
            <button type="button" className="editor-action" onClick={addCrop} disabled={!bounds || saving}>자르기 적용</button>
          </div>
          <p className={styles.dimensions}>{canvasSize.width} × {canvasSize.height}px</p>
        </div>
        {notice && <p className={styles.status} role="status">{notice}</p>}
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
      </>}
      <footer className={styles.footer}>
        {saving && <span className={styles.status} role="status">편집한 이미지를 저장하는 중…</span>}
        <button type="button" className="editor-action" onClick={onCancel} disabled={saving}>취소</button>
        <button type="button" className={`editor-action ${styles.primary}`} onClick={() => void apply()} disabled={!bitmap || !canvasSize.width || saving || cursor === 0}>이미지 적용</button>
      </footer>
    </section>
  </div>, document.body);
}

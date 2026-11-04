"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./image-editor.module.css";
import { clampCropRect, createMosaicOperation, createPenOperation, createResampleOperation, createTextOperation, safeBitmapSize, type CropOperation, type ImageEditOperation, type PenPoint, type TextOperation } from "../image-edit-model";

type ActionName = "crop" | "mosaic" | "text" | "pen" | "resample" | "undo" | "redo" | "check" | "cancel";
const actionPaths: Record<ActionName, string[]> = {
  crop: ["M6 3v13a2 2 0 0 0 2 2h13", "M3 6h13a2 2 0 0 1 2 2v13"],
  mosaic: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  text: ["M4 6V4h16v2", "M12 4v16", "M8 20h8"],
  pen: ["m15 4 5 5", "m4 15 11-11a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1z", "m4 15 5 5"],
  resample: ["M8 3H3v5", "M3 3l6 6", "M16 21h5v-5", "m15 15 6 6", "M14 3h7v7", "M3 14v7h7"],
  undo: ["M8 4 3 9l5 5", "M3 9h10a7 7 0 0 1 0 14"],
  redo: ["m16 4 5 5-5 5", "M21 9H11a7 7 0 0 0 0 14"],
  check: ["m5 12 4 4L19 6"], cancel: ["m6 6 12 12", "M18 6 6 18"],
};
function ActionIcon({ name }: { name: ActionName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{actionPaths[name].map((d, index) => <path key={index} d={d}/>)}</svg>;
}

export type ImageEditorProps = {
  src: string;
  fileName?: string;
  onApply: (file: File) => Promise<void>;
  onCancel: () => void;
};

type CropSelection = { startX: number; startY: number; endX: number; endY: number };
type Tool = "crop" | "mosaic" | "text" | "pen" | "resample";

function cropBounds(selection: CropSelection, width: number, height: number): CropOperation | null {
  return clampCropRect(selection.startX, selection.startY, selection.endX, selection.endY, { width, height });
}

function replayHistory(source: ImageBitmap, operations: ImageEditOperation[], cursor: number): HTMLCanvasElement {
  let current = document.createElement("canvas");
  current.width = source.width;
  current.height = source.height;
  current.getContext("2d")!.drawImage(source, 0, 0);
  for (const operation of operations.slice(0, cursor)) {
    if (operation.type === "mosaic") {
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.ceil(operation.width / operation.blockSize));
      small.height = Math.max(1, Math.ceil(operation.height / operation.blockSize));
      const smallContext = small.getContext("2d")!;
      smallContext.imageSmoothingEnabled = true;
      smallContext.drawImage(current, operation.x, operation.y, operation.width, operation.height, 0, 0, small.width, small.height);
      const next = document.createElement("canvas");
      next.width = current.width;
      next.height = current.height;
      next.getContext("2d")!.drawImage(current, 0, 0);
      const outputContext = next.getContext("2d")!;
      outputContext.imageSmoothingEnabled = false;
      outputContext.drawImage(small, 0, 0, small.width, small.height, operation.x, operation.y, operation.width, operation.height);
      current.width = 0;
      current.height = 0;
      small.width = 0;
      small.height = 0;
      current = next;
      continue;
    }
    if (operation.type === "text") {
      drawTextOperation(current.getContext("2d")!, operation, current.width);
      continue;
    }
    if (operation.type === "pen") {
      const context = current.getContext("2d")!;
      context.strokeStyle = operation.color;
      context.lineWidth = operation.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(operation.points[0].x, operation.points[0].y);
      if (operation.points.length === 1) context.lineTo(operation.points[0].x + 0.1, operation.points[0].y + 0.1);
      else for (const point of operation.points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
      continue;
    }
    if (operation.type === "resample") {
      const next = document.createElement("canvas");
      next.width = operation.width;
      next.height = operation.height;
      const context = next.getContext("2d")!;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(current, 0, 0, operation.width, operation.height);
      current.width = 0;
      current.height = 0;
      current = next;
      continue;
    }
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

function drawTextOperation(context: CanvasRenderingContext2D, operation: TextOperation, canvasWidth: number) {
  context.fillStyle = operation.color;
  context.font = `${operation.fontSize}px system-ui, sans-serif`;
  context.textBaseline = "top";
  const maxWidth = Math.max(1, canvasWidth - operation.x - 12);
  const lineHeight = Math.round(operation.fontSize * 1.25);
  let y = operation.y;
  for (const paragraph of operation.text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > maxWidth) {
        context.fillText(line, operation.x, y, maxWidth);
        y += lineHeight;
        line = word;
      } else line = next;
    }
    if (line) { context.fillText(line, operation.x, y, maxWidth); y += lineHeight; }
  }
}

export function ImageEditor({ src, fileName = "image", onApply, onCancel }: ImageEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadError, setLoadError] = useState("");
  const [operations, setOperations] = useState<ImageEditOperation[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState<CropSelection | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const confirmationRef = useRef<HTMLElement>(null);
  const requestCancel = () => { if (!saving) setConfirmCancel(true); };
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [tool, setTool] = useState<Tool>("crop");
  const [mosaicBlockSize, setMosaicBlockSize] = useState(12);
  const [textValue, setTextValue] = useState("");
  const [textFontSize, setTextFontSize] = useState(32);
  const [textColor, setTextColor] = useState("#24352b");
  const [penWidth, setPenWidth] = useState(8);
  const [penColor, setPenColor] = useState("#e53935");
  const [strokePreview, setStrokePreview] = useState<PenPoint[] | null>(null);
  const [resampleWidth, setResampleWidth] = useState(0);
  const [resampleHeight, setResampleHeight] = useState(0);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const workingRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const latestRef = useRef({ saving, confirmCancel });
  latestRef.current = { saving, confirmCancel };

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
    if (mounted) (confirmCancel ? confirmationRef : dialogRef).current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [mounted, confirmCancel]);

  const redraw = useCallback(() => {
    if (!bitmap || !displayRef.current) return;
    const working = replayHistory(bitmap, operations, cursor);
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
    if (tool === "resample" && workingRef.current) {
      setResampleWidth(workingRef.current.width);
      setResampleHeight(workingRef.current.height);
    }
  }, [tool, operations, cursor]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const activeDialog = latestRef.current.confirmCancel ? confirmationRef.current : dialogRef.current;
      if (event.key === "Tab" && activeDialog) {
        const controls = Array.from(activeDialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key !== "Escape" || latestRef.current.saving) return;
      event.preventDefault();
      setConfirmCancel(previous => !previous);
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
  const addMosaic = () => {
    if (!selection || !workingRef.current) return;
    const rect = cropBounds(selection, workingRef.current.width, workingRef.current.height);
    if (!rect) { setNotice("모자이크 영역을 조금 더 크게 선택하세요."); return; }
    setOperations(previous => [...previous.slice(0, cursor), createMosaicOperation(rect, mosaicBlockSize)]);
    setCursor(cursor + 1);
    setSelection(null);
    setPointerStart(null);
    setNotice("모자이크를 적용했습니다. 실행 취소로 되돌릴 수 있습니다.");
  };
  const addResample = () => {
    const operation = createResampleOperation(resampleWidth, resampleHeight);
    if (!operation) { setNotice("너비와 높이는 1px 이상이어야 합니다."); return; }
    setOperations(previous => [...previous.slice(0, cursor), operation]);
    setCursor(cursor + 1);
    setNotice(`${operation.width} × ${operation.height}px로 실제 이미지 크기를 변경했습니다.`);
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
    if (tool === "text") {
      const operation = createTextOperation(textValue, point.x, point.y, workingRef.current, textFontSize, textColor);
      if (!operation) { setNotice("먼저 표시할 문구를 입력하세요."); return; }
      setOperations(previous => [...previous.slice(0, cursor), operation]);
      setCursor(cursor + 1);
      setNotice("텍스트를 배치했습니다. 실행 취소로 되돌릴 수 있습니다.");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "pen") {
      setStrokePreview([point]);
      return;
    }
    setPointerStart(point);
    setSelection({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
    setNotice("");
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "pen" && strokePreview) {
      const point = pointerCoordinates(event);
      if (point) setStrokePreview(previous => {
        if (!previous || previous.length >= 5000) return previous;
        const last = previous[previous.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return previous;
        return [...previous, point];
      });
      return;
    }
    if (!pointerStart) return;
    const point = pointerCoordinates(event);
    if (point) setSelection({ startX: pointerStart.x, startY: pointerStart.y, endX: point.x, endY: point.y });
  };
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "pen" && strokePreview && workingRef.current) {
      const point = pointerCoordinates(event);
      const points = point ? [...strokePreview, point] : strokePreview;
      const operation = createPenOperation(points, workingRef.current, penWidth, penColor);
      if (operation) {
        setOperations(previous => [...previous.slice(0, cursor), operation]);
        setCursor(cursor + 1);
      }
      setStrokePreview(null);
      return;
    }
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
  return createPortal(<div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) requestCancel(); }}>
    <section ref={dialogRef} inert={confirmCancel} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="image-editor-title" aria-describedby="image-editor-help" tabIndex={-1}>
      <header className={styles.header}>
        <div><h2 id="image-editor-title">이미지 편집</h2><p id="image-editor-help">{tool === "text" ? "문구와 모양을 정한 뒤 이미지 위치를 클릭해 배치하세요." : tool === "pen" ? "색과 굵기를 정한 뒤 이미지 위에 그리세요." : tool === "resample" ? "실제 픽셀 너비와 높이를 변경합니다. 원본은 편집 중 보존됩니다." : "영역을 드래그해 선택하고 도구를 적용하세요. 원본은 편집 중 보존됩니다."}</p></div>

      </header>
      {loadError ? <div className={styles.error} role="alert">{loadError}</div> : !bitmap ? <p className={styles.status} role="status">이미지를 불러오는 중…</p> : <>
        <div className={styles.toolStrip} role="toolbar" aria-label="이미지 편집 도구">
          <div className={styles.toolChoices}>
            {([["crop", "자르기"], ["mosaic", "모자이크"], ["text", "글씨"], ["pen", "펜"], ["resample", "크기"]] as const).map(([value, label]) => <button key={value} type="button" className="editor-action" aria-label={value === "resample" ? "크기 변경" : label} aria-pressed={tool === value} onClick={() => { setTool(value); setSelection(null); }} disabled={saving}><ActionIcon name={value}/><span>{label}</span></button>)}
          </div>
          <div className={styles.historyActions}>
            <button type="button" className="editor-action" title="실행 취소" aria-label="실행 취소" onClick={undo} disabled={cursor === 0 || saving}><ActionIcon name="undo"/></button>
            <button type="button" className="editor-action" title="다시 실행" aria-label="다시 실행" onClick={redo} disabled={cursor >= operations.length || saving}><ActionIcon name="redo"/></button>
          </div>
        </div>
        <div className={styles.stage} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { setPointerStart(null); setStrokePreview(null); }}>
          <canvas ref={displayRef} className={styles.canvas} aria-label="편집할 이미지" />
          {bounds && current && <div className={styles.cropMarquee} aria-hidden="true" style={{ left: `${bounds.x / current.width * 100}%`, top: `${bounds.y / current.height * 100}%`, width: `${bounds.width / current.width * 100}%`, height: `${bounds.height / current.height * 100}%` }} />}
          {strokePreview?.length && current && <svg className={styles.penPreview} viewBox={`0 0 ${current.width} ${current.height}`} preserveAspectRatio="none" aria-hidden="true"><polyline className={styles.penLine} points={strokePreview.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <div className={styles.toolbar}>
          <div className={styles.actions}>
            {tool === "crop" ? <button type="button" className="editor-action" onClick={addCrop} disabled={!bounds || saving}><ActionIcon name="check"/><span>자르기 적용</span></button> : tool === "mosaic" ? <>
              <label className={styles.rangeLabel}>모자이크 크기 <input type="range" min="4" max="48" step="2" value={mosaicBlockSize} onChange={event => setMosaicBlockSize(Number(event.currentTarget.value))} disabled={saving} /></label>
              <button type="button" className="editor-action" onClick={addMosaic} disabled={!bounds || saving}><ActionIcon name="check"/><span>모자이크 적용</span></button>
            </> : tool === "text" ? <>
              <label className={styles.rangeLabel}>글자 크기 <input type="range" min="16" max="160" step="2" value={textFontSize} onChange={event => setTextFontSize(Number(event.currentTarget.value))} disabled={saving} /></label>
              <label className={styles.colorLabel}>글자색 <input type="color" value={textColor} onChange={event => setTextColor(event.currentTarget.value)} disabled={saving} /></label>
              <input className={styles.textInput} aria-label="이미지에 넣을 텍스트" placeholder="텍스트를 입력한 뒤 이미지 위치를 클릭하세요" value={textValue} maxLength={500} onChange={event => setTextValue(event.currentTarget.value)} disabled={saving} />
            </> : tool === "pen" ? <>
              <label className={styles.rangeLabel}>펜 굵기 <input type="range" min="1" max="64" value={penWidth} onChange={event => setPenWidth(Number(event.currentTarget.value))} disabled={saving} /></label>
              <label className={styles.colorLabel}>펜 색상 <input type="color" value={penColor} onChange={event => setPenColor(event.currentTarget.value)} disabled={saving} /></label>
            </> : <>
              <label className={styles.dimensionLabel}>너비 <input type="number" min="1" max="8000" value={resampleWidth || ""} onChange={event => {
                const next = Math.max(1, Number(event.currentTarget.value) || 1);
                setResampleWidth(next);
                if (keepAspectRatio && current) setResampleHeight(Math.max(1, Math.round(next * current.height / current.width)));
              }} disabled={saving} /> px</label>
              <label className={styles.dimensionLabel}>높이 <input type="number" min="1" max="8000" value={resampleHeight || ""} onChange={event => {
                const next = Math.max(1, Number(event.currentTarget.value) || 1);
                setResampleHeight(next);
                if (keepAspectRatio && current) setResampleWidth(Math.max(1, Math.round(next * current.width / current.height)));
              }} disabled={saving} /> px</label>
              <label className={styles.checkLabel}><input type="checkbox" checked={keepAspectRatio} onChange={event => setKeepAspectRatio(event.currentTarget.checked)} disabled={saving} /> 비율 유지</label>
              <button type="button" className="editor-action" onClick={addResample} disabled={saving}><ActionIcon name="check"/><span>크기 변경 적용</span></button>
            </>}
          </div>
          <p className={styles.dimensions}>{canvasSize.width} × {canvasSize.height}px</p>
        </div>
        {notice && <p className={styles.status} role="status">{notice}</p>}
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
      </>}
      <footer className={styles.footer}>
        {saving && <span className={styles.status} role="status">편집한 이미지를 저장하는 중…</span>}
        <button type="button" className="editor-action" onClick={requestCancel} disabled={saving}><ActionIcon name="cancel"/><span>취소</span></button>
        <button type="button" className={`editor-action ${styles.primary}`} onClick={() => void apply()} disabled={!bitmap || !canvasSize.width || saving || cursor === 0}><ActionIcon name="check"/><span>저장</span></button>
      </footer>
    </section>
    {confirmCancel && <section ref={confirmationRef} className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="image-discard-title" aria-describedby="image-discard-description" tabIndex={-1}>
      <h2 id="image-discard-title">이미지 편집을 취소할까요?</h2>
      <p id="image-discard-description">저장하지 않은 이미지 편집 내용이 모두 사라집니다.</p>
      <div className={styles.confirmActions}>
        <button type="button" className="editor-action" onClick={() => setConfirmCancel(false)}>계속 편집</button>
        <button type="button" className={`editor-action ${styles.discard}`} onClick={onCancel}>편집 취소</button>
      </div>
    </section>}
  </div>, document.body);
}

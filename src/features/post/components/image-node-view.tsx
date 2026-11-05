"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import styles from "./image-node-view.module.css";
import { selectableRepresentativeImage } from "../post-images";
import { imageCornerWidthDelta, normalizeImageDisplaySize, resizedImageDimensions } from "../image-display-size";
import { ImageEditor } from "./image-editor";

type ImageEditingValue = { prepare?: (file: File) => Promise<{ src: string; previewUrl: string }>; disabled?: boolean };
const ImageEditingContext = createContext<ImageEditingValue>({});
export function ImageEditingProvider({ children, ...value }: ImageEditingValue & { children: React.ReactNode }) {
  return <ImageEditingContext.Provider value={value}>{children}</ImageEditingContext.Provider>;
}

type RepresentativeContextValue = {
  enabled?: boolean;
  selectedSrc: string | null;
  disabled: boolean;
  onSelect: (src: string) => void;
};

const RepresentativeContext = createContext<RepresentativeContextValue>({
  selectedSrc: null,
  disabled: false,
  onSelect: () => {},
});

export function RepresentativeImageProvider({ enabled = true, selectedSrc, disabled, onSelect, children }: RepresentativeContextValue & { children: React.ReactNode }) {
  return <RepresentativeContext.Provider value={{ enabled, selectedSrc, disabled, onSelect }}>{children}</RepresentativeContext.Provider>;
}

const corners = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type Corner = typeof corners[number];
const cornerLabels: Record<Corner, string> = {"top-left":"왼쪽 위", "top-right":"오른쪽 위", "bottom-left":"왼쪽 아래", "bottom-right":"오른쪽 아래"};

const safeImageHref = (value: unknown) => typeof value === "string" && /^(?:https?:|blob:)/i.test(value.trim());

export function ImageNodeView({ node, selected, deleteNode, editor, updateAttributes }: NodeViewProps) {
  const representative = useContext(RepresentativeContext);
  const imageEditing = useContext(ImageEditingContext);
  const [editing, setEditing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; corner: Corner; startWidth: number; ratio: number; maxWidth: number; previewWidth: number } | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const displaySize = normalizeImageDisplaySize(node.attrs.width, node.attrs.height);
  const editable = editor.isEditable && !representative.disabled;
  const src = safeImageHref(node.attrs.src) ? node.attrs.src : "";
  const mediaSrc = safeImageHref(node.attrs.mediaSrc) ? node.attrs.mediaSrc : "";
  const stableSrc = mediaSrc || src;
  const isRepresentative = !!stableSrc && representative.selectedSrc === stableSrc;
  const finishDrag = (commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (commit && editor.isEditable && !editor.isDestroyed && !representative.disabled && Math.abs(drag.previewWidth - drag.startWidth) >= 1) {
      updateAttributes(resizedImageDimensions(drag.previewWidth, drag.ratio, drag.maxWidth));
    }
    setPreviewWidth(null);
  };
  const onPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.previewWidth = resizedImageDimensions(drag.startWidth + imageCornerWidthDelta(event.clientX - drag.startX, event.clientY - drag.startY, drag.ratio, drag.corner), drag.ratio, drag.maxWidth).width;
    setPreviewWidth(drag.previewWidth);
  };
  const onPointerUp = () => finishDrag(true);
  const onPointerCancel = () => finishDrag(false);
  const onWindowKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") finishDrag(false); };
  const handlersRef = useRef({ onPointerMove, onPointerUp, onPointerCancel, onWindowKeyDown });
  handlersRef.current = { onPointerMove, onPointerUp, onPointerCancel, onWindowKeyDown };
  useEffect(() => {
    const move = (event: PointerEvent) => handlersRef.current.onPointerMove(event);
    const up = () => handlersRef.current.onPointerUp();
    const cancel = () => handlersRef.current.onPointerCancel();
    const keydown = (event: KeyboardEvent) => handlersRef.current.onWindowKeyDown(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  const startResize = (event: React.PointerEvent<HTMLButtonElement>, corner: Corner) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const parentWidth = image.parentElement?.parentElement?.clientWidth || rect.width;
    const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : rect.width / Math.max(1, rect.height);
    const startWidth = rect.width;
    dragRef.current = { startX: event.clientX, startY: event.clientY, corner, startWidth, ratio, maxWidth: parentWidth, previewWidth: startWidth };
    setPreviewWidth(rect.width);
  };
  const resizeByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!editable || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const image = imageRef.current;
    if (!image) return;
    const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : image.clientWidth / Math.max(1, image.clientHeight);
    const maxWidth = image.parentElement?.parentElement?.clientWidth || image.clientWidth;
    const current = displaySize.width ?? image.getBoundingClientRect().width;
    const next = event.key === "Home" ? 80 : event.key === "End" ? maxWidth : current + (event.key === "ArrowRight" ? 16 : -16);
    updateAttributes(resizedImageDimensions(next, ratio, maxWidth));
  };
  return <NodeViewWrapper as="figure" className={styles.image} data-align={node.attrs.align ?? "left"} data-selected={selected || undefined} contentEditable={false} draggable="true">
    {src && <img ref={imageRef} src={src} alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""} width={displaySize.width ?? undefined} height={displaySize.height ?? undefined} style={{ width: previewWidth !== null ? `${previewWidth}px` : displaySize.width ? `${displaySize.width}px` : "auto", height: "auto" }} draggable="true" />}
    {editable && corners.map(corner => <button key={corner} className={styles.resizeHandle} data-corner={corner} data-resizing={previewWidth !== null && dragRef.current?.corner === corner || undefined} type="button" contentEditable={false} data-image-node-control="" draggable={false} aria-label={`이미지 ${cornerLabels[corner]} 크기 조절`} aria-valuemin={80} aria-valuemax={1600} aria-valuenow={Math.round(previewWidth ?? displaySize.width ?? imageRef.current?.getBoundingClientRect().width ?? 0)} aria-valuetext={`${Math.round(previewWidth ?? displaySize.width ?? imageRef.current?.getBoundingClientRect().width ?? 0)} 픽셀`} role="slider" onPointerDown={event => startResize(event, corner)} onKeyDown={resizeByKeyboard} onClick={event => event.stopPropagation()} />)}
    <div className={styles.tools} role="group" aria-label="이미지 편집" contentEditable={false} data-image-node-control="">
    {representative.enabled !== false && selectableRepresentativeImage(stableSrc) && <button
      className={styles.representativeButton}
      type="button"
      contentEditable={false}
      aria-label={isRepresentative ? "대표 이미지로 선택됨" : "대표 이미지로 선택"}
      aria-pressed={isRepresentative}
      disabled={representative.disabled}
      data-representative-image-control=""
      data-image-node-control=""
      draggable={false}
      onClick={event => { event.stopPropagation(); representative.onSelect(stableSrc); }}
      onKeyDown={event => event.stopPropagation()}
    ><svg aria-hidden="true" viewBox="0 0 20 20" fill="none">{isRepresentative ? <path d="m4 10 4 4 8-8"/> : <><rect x="3" y="3" width="14" height="14" rx="2"/><path d="m3 14 4-4 3 3 3-4 4 5"/></>}</svg><span>대표 이미지</span></button>}
    {imageEditing.prepare && <button type="button" className="editor-action" disabled={!editable || imageEditing.disabled} data-image-node-control="" draggable={false} onMouseDown={event => event.preventDefault()} onClick={event => { event.stopPropagation(); setEditing(true); }} onKeyDown={event => event.stopPropagation()}>이미지 편집</button>}
    <button
      className={styles.deleteButton}
      type="button"
      contentEditable={false}
      aria-label="본문 이미지 삭제"
      title="이미지 삭제"
      disabled={representative.disabled || !editor.isEditable}
      data-image-node-control=""
      draggable={false}
      onMouseDown={event => event.preventDefault()}
      onClick={event => { event.stopPropagation(); if (!representative.disabled && editor.isEditable) { deleteNode(); editor.view.focus(); } }}
      onKeyDown={event => event.stopPropagation()}
    ><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
    </div>
    {editing && <ImageEditor src={src} fileName={typeof node.attrs.alt === "string" ? node.attrs.alt : "image"} onCancel={() => setEditing(false)} onApply={async file => {
      if (!imageEditing.prepare || !editor.isEditable || editor.isDestroyed || imageEditing.disabled) throw new Error("지금은 이미지를 변경할 수 없습니다.");
      const result = await imageEditing.prepare(file);
      if (!safeImageHref(result.src) || !safeImageHref(result.previewUrl)) throw new Error("이미지 응답 주소가 올바르지 않습니다.");
      if (editor.isDestroyed || !editor.isEditable) throw new Error("편집 화면을 다시 확인해 주세요.");
      updateAttributes({ src: result.previewUrl, mediaSrc: result.src, width: null, height: null });
      if (isRepresentative) representative.onSelect(result.src);
      setEditing(false);
    }}/>} 
  </NodeViewWrapper>;
}

"use client";

import { createContext, useContext } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import styles from "./image-node-view.module.css";
import { selectableRepresentativeImage } from "../post-images";

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

const safeImageHref = (value: unknown) => typeof value === "string" && /^(?:https?:|blob:)/i.test(value.trim());

export function ImageNodeView({ node, selected, deleteNode, editor }: NodeViewProps) {
  const representative = useContext(RepresentativeContext);
  const src = safeImageHref(node.attrs.src) ? node.attrs.src : "";
  const mediaSrc = safeImageHref(node.attrs.mediaSrc) ? node.attrs.mediaSrc : "";
  const stableSrc = mediaSrc || src;
  const isRepresentative = !!stableSrc && representative.selectedSrc === stableSrc;
  return <NodeViewWrapper as="figure" className={styles.image} data-align={node.attrs.align ?? "left"} data-selected={selected || undefined} contentEditable={false} draggable="true">
    {src && <img src={src} alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""} draggable="true" />}
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
      onClick={event => { event.stopPropagation(); if (!representative.disabled && editor.isEditable) deleteNode(); }}
      onKeyDown={event => event.stopPropagation()}
    ><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
    </div>
  </NodeViewWrapper>;
}

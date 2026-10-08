"use client";

import { createContext, useContext } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import styles from "./image-node-view.module.css";
import { selectableRepresentativeImage } from "../post-images";

type RepresentativeContextValue = {
  selectedSrc: string | null;
  disabled: boolean;
  onSelect: (src: string) => void;
};

const RepresentativeContext = createContext<RepresentativeContextValue>({
  selectedSrc: null,
  disabled: false,
  onSelect: () => {},
});

export function RepresentativeImageProvider({ selectedSrc, disabled, onSelect, children }: RepresentativeContextValue & { children: React.ReactNode }) {
  return <RepresentativeContext.Provider value={{ selectedSrc, disabled, onSelect }}>{children}</RepresentativeContext.Provider>;
}

const safeImageHref = (value: unknown) => typeof value === "string" && /^(?:https?:|blob:)/i.test(value.trim());

export function ImageNodeView({ node, selected }: NodeViewProps) {
  const representative = useContext(RepresentativeContext);
  const src = safeImageHref(node.attrs.src) ? node.attrs.src : "";
  const mediaSrc = safeImageHref(node.attrs.mediaSrc) ? node.attrs.mediaSrc : "";
  const stableSrc = mediaSrc || src;
  const isRepresentative = !!stableSrc && representative.selectedSrc === stableSrc;
  return <NodeViewWrapper as="figure" className={styles.image} data-align={node.attrs.align ?? "left"} data-selected={selected || undefined} contentEditable={false} draggable="true">
    {src && <img src={src} alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""} draggable="true" />}
    {selectableRepresentativeImage(stableSrc) && <button
      className={styles.representativeButton}
      type="button"
      contentEditable={false}
      aria-label={isRepresentative ? "대표 이미지로 선택됨" : "대표 이미지로 선택"}
      aria-pressed={isRepresentative}
      disabled={representative.disabled}
      data-representative-image-control=""
      draggable={false}
      onClick={event => { event.stopPropagation(); representative.onSelect(stableSrc); }}
      onKeyDown={event => event.stopPropagation()}
    >대표이미지 ✓</button>}
  </NodeViewWrapper>;
}

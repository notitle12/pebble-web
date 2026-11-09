"use client";

import { useEffect, useId, useState } from "react";
import styles from "./mermaid-preview.module.css";

const maxSourceLength = 12_000;

function loadMermaid() {
  return import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "sandbox", suppressErrorRendering: true,
      maxTextSize: maxSourceLength, maxEdges: 300, htmlLabels: false, theme: "neutral" });
    return mermaid;
  });
}

let renderer: ReturnType<typeof loadMermaid> | undefined;

// Mermaid sandbox mode returns an iframe. Display its SVG as an image so links,
// scripts and external resources cannot run in the displayed diagram.
function diagramImage(sandboxMarkup: string) {
  const encoded = sandboxMarkup.match(/\bsrc="data:text\/html;charset=UTF-8;base64,([A-Za-z0-9+/=]+)"/)?.[1];
  if (!encoded) throw new Error("Missing Mermaid sandbox output");
  const html = new TextDecoder().decode(Uint8Array.from(atob(encoded), byte => byte.charCodeAt(0)));
  const svg = html.match(/<svg\b[\s\S]*<\/svg>/i)?.[0];
  if (!svg) throw new Error("Missing Mermaid SVG");
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

export function MermaidPreview({ source, editing = false, onRendered }: { source: string; editing?: boolean; onRendered?: (source: string) => void }) {
  const id = useId().replace(/[^\w-]/g, "");
  const [result, setResult] = useState<{ source: string; url?: string; error?: string }>();
  const code = source.trim();
  const inputError = code.length > maxSourceLength ? "Mermaid 원문은 12,000자까지 미리 볼 수 있어요."
    : /^---(?:\r?\n|$)|%%\s*\{/.test(code) ? "이 블로그에서는 Mermaid 설정 구문 없이 다이어그램을 작성해 주세요." : "";

  useEffect(() => {
    if (!code || inputError) return;
    let active = true;
    let imageUrl: string | undefined;
    const timeout = window.setTimeout(async () => {
      let host: HTMLDivElement | undefined;
      try {
        const mermaid = await (renderer ??= loadMermaid());
        if (!active) return;
        host = document.createElement("div");
        host.className = styles.renderHost;
        host.setAttribute("aria-hidden", "true");
        document.body.append(host);
        const { svg } = await mermaid.render(`pebble-mermaid-${id}`, code, host);
        if (!active) return;
        imageUrl = diagramImage(svg);
        setResult({ source: code, url: imageUrl });
        onRendered?.(code);
      } catch {
        if (active) setResult({ source: code, error: "다이어그램을 표시할 수 없어요. Mermaid 문법을 확인해 주세요." });
      } finally {
        host?.remove();
      }
    }, editing ? 240 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [code, editing, id, inputError, onRendered]);

  const current = result?.source === code ? result : undefined;
  return <div className={styles.preview}>
    {inputError || current?.error ? <p role="status">{inputError || current?.error}</p>
      : current?.url ? <img src={current.url} alt="Mermaid 다이어그램"/>
      : <p role="status">{code ? "다이어그램을 그리는 중이에요." : "Mermaid 원문을 입력하면 미리보기가 표시돼요."}</p>}
  </div>;
}

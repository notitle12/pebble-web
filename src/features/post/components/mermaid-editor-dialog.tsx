"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MermaidPreview } from "./mermaid-preview";
import styles from "./mermaid-preview.module.css";

export function MermaidEditorDialog({ initialSource = "", onComplete, onCancel }: {
  initialSource?: string;
  onComplete: (source: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [source, setSource] = useState(initialSource);
  const [renderedSource, setRenderedSource] = useState<string | null>(null);
  const complete = source.trim().length > 0 && source.trim() === renderedSource;
  useEffect(() => {
    dialog.current?.showModal();
    input.current?.focus();
  }, []);

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event => {
    event.preventDefault(); onCancel();
  }}>
    <form onSubmit={event => { event.preventDefault(); if (complete) onComplete(source); }}>
      <h2 id={id}>Mermaid 다이어그램</h2>
      <div className={styles.editor}>
        <label>코드<textarea ref={input} value={source} onChange={event => setSource(event.target.value)} spellCheck={false} placeholder={'flowchart LR\n  A[요청] --> B[응답]'} /></label>
        <section aria-label="다이어그램 미리보기"><span>미리보기</span><MermaidPreview source={source} editing onRendered={setRenderedSource}/></section>
      </div>
      <footer><button type="button" onClick={onCancel}>취소</button><button type="submit" disabled={!complete}>완료</button></footer>
    </form>
  </dialog>, document.body);
}

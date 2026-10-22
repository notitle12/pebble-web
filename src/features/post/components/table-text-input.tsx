"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { transitionTableInputComposition, type TableInputCompositionState } from "./table-input-composition";

export function TableTextInput({ value, disabled, onCommit, onBlur, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onCompositionStart" | "onCompositionEnd"> & { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const composition = useRef<TableInputCompositionState>({ composing: false });
  useEffect(() => { if (!composition.current.composing) setDraft(value); }, [value]);
  const handleComposition = (event: Parameters<typeof transitionTableInputComposition>[1]) => {
    const result = transitionTableInputComposition(composition.current, event);
    composition.current = result.state;
    if ("value" in event) setDraft(event.value);
    if (result.commit !== undefined) onCommit(result.commit);
  };
  return <input {...props} disabled={disabled} value={draft}
    onCompositionStart={() => handleComposition({ type: "compositionstart" })}
    onChange={event => handleComposition({ type: "change", value: event.currentTarget.value })}
    onCompositionEnd={event => handleComposition({ type: "compositionend", value: event.currentTarget.value })}
    onBlur={event => { handleComposition({ type: "blur", value: event.currentTarget.value }); onBlur?.(event); }} />;
}


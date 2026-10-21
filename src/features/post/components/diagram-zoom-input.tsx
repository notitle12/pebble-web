"use client";
import { useEffect, useState } from "react";

export function DiagramZoomInput({ zoom, onChange, label, minPercent = 40 }: {
  zoom: number;
  onChange: (zoom: number) => void;
  label: string;
  minPercent?: number;
}) {
  const percent = Math.round(zoom * 100);
  const [draft, setDraft] = useState(String(percent));
  useEffect(() => { setDraft(String(percent)); }, [percent]);
  const commit = () => {
    const parsed = Number(draft);
    const next = draft.trim() && Number.isFinite(parsed) ? Math.min(300, Math.max(minPercent, Math.round(parsed))) : percent;
    setDraft(String(next));
    if (next !== percent) onChange(next / 100);
  };
  return <label className="diagram-zoom-field">
    <input type="number" min={minPercent} max={300} step={1} inputMode="numeric" aria-label={label}
      value={draft} onChange={event => {
        const value = event.target.value;
        setDraft(value);
        const parsed = Number(value);
        if (value.trim() && Number.isFinite(parsed) && parsed >= minPercent && parsed <= 300) {
          onChange(Math.round(parsed) / 100);
        }
      }} onBlur={commit}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }
      }}/>
    <span aria-hidden="true">%</span>
  </label>;
}

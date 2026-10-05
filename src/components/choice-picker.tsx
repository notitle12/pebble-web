"use client";

import { useEffect, useRef, useState } from "react";

type Props = { label: string; name: string; controlId: string; allLabel: string; options: { id: string; name: string }[]; selected?: string; disabled?: boolean };
export function ChoicePicker({ label: fieldLabel, name, controlId, allLabel, options: tags, selected = "", disabled = false }: Props) {
  const [value, setValue] = useState(selected);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const label = tags.find(tag => tag.id === value)?.name ?? (value ? `선택한 항목 (${value})` : allLabel);
  const select = (next: string) => { setValue(next); setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className="tag-picker" onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <input type="hidden" name={name} value={value} />
    <button ref={trigger} id={controlId} className="tag-trigger" type="button" disabled={disabled}
      aria-label={`${fieldLabel}: ${label}`} aria-expanded={open} aria-controls={`${controlId}-options`} onClick={() => setOpen(!open)}>
      <span>{label}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id={`${controlId}-options`} className="tag-options" role="region" aria-label={`${fieldLabel} 선택`}>
      {[{ id: "", name: allLabel }, ...tags, ...(value && !tags.some(tag => tag.id === value) ? [{ id: value, name: label }] : [])].map(tag =>
        <button key={tag.id} type="button" aria-pressed={value === tag.id} onClick={() => select(tag.id)}>
          <span>{tag.name}</span>{value === tag.id && <span aria-hidden="true">✓</span>}
        </button>)}
    </div>}
  </div>;
}

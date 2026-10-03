"use client";

import { useEffect, useRef, useState } from "react";

type Props = { tags: { id: string; name: string }[]; selected?: string; disabled?: boolean };
export function TagPicker({ tags, selected = "", disabled = false }: Props) {
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
  const label = tags.find(tag => tag.id === value)?.name ?? (value ? `선택한 태그 (${value})` : "전체 태그");
  const select = (next: string) => { setValue(next); setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className="tag-picker" onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <input type="hidden" name="tagId" value={value} />
    <button ref={trigger} id="post-tag" className="tag-trigger" type="button" disabled={disabled}
      aria-label={`기술 태그: ${label}`} aria-expanded={open} aria-controls="tag-options" onClick={() => setOpen(!open)}>
      <span>{label}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="tag-options" className="tag-options" role="region" aria-label="기술 태그 선택">
      {[{ id: "", name: "전체 태그" }, ...tags, ...(value && !tags.some(tag => tag.id === value) ? [{ id: value, name: label }] : [])].map(tag =>
        <button key={tag.id} type="button" aria-pressed={value === tag.id} onClick={() => select(tag.id)}>
          <span>{tag.name}</span>{value === tag.id && <span aria-hidden="true">✓</span>}
        </button>)}
    </div>}
  </div>;
}

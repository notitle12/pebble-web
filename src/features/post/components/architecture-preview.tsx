"use client";
import { useState } from "react";
import type { ArchitectureSpec } from "../api/post-list";
import { ArchitectureEditor } from "./architecture-editor";
export function ArchitecturePreview() {
  const [value, setValue] = useState<ArchitectureSpec | null>(null);
  return <><ArchitectureEditor onChange={setValue} /><section className="architecture-json-panel" aria-label="작성기 전달 값"><h2>작성기 전달 값</h2>{value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>유효한 입력을 완료하면 ArchitectureSpec 값이 표시됩니다.</p>}</section></>;
}

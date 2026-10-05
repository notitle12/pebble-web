"use client";
import { useState } from "react";
import type { ArchitectureSpec } from "../api/post-list";
import { ArchitectureEditor } from "./architecture-editor";
export function ArchitecturePreview() {
  const [value, setValue] = useState<ArchitectureSpec | null>(null);
  return <><ArchitectureEditor onChange={setValue} /><details className="architecture-json-panel"><summary>작성 데이터 확인</summary>{value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>유효한 입력을 완료하면 ArchitectureSpec 값이 표시됩니다.</p>}</details></>;
}

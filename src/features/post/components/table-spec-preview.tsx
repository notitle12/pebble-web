"use client";
import { useState } from "react";
import type { TableSpec } from "../api/post-list";
import { TableSpecEditor } from "./table-spec-editor";

export function TableSpecPreview() {
  const [value, setValue] = useState<TableSpec | null>(null);
  return <>
    <TableSpecEditor onChange={setValue} />
    <section className="table-spec-json" aria-label="작성기 전달 값">
      <h2>작성기 전달 값</h2>
      {value ? <pre><code>{JSON.stringify(value, null, 2)}</code></pre> : <p>유효한 입력을 완료하면 TableSpec 값이 표시됩니다.</p>}
    </section>
  </>;
}

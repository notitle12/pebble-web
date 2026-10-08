"use client";
import { useState } from "react";
import { PostEditor, type PostEditorValue } from "./post-editor";
import { createEditorBlock } from "../post-editor-model";
import { PostBody } from "./post-body";
const example = (): PostEditorValue => ({ title: "본문 블록 편집 미리보기", summary: "", tagIds: [], categoryId: null, boardId: null, projectId: null, blocks: [{ ...createEditorBlock("HTML"), content: "<p>본문을 작성하고 상단 도구에서 블록을 삽입해 보세요.</p>" }] });
export function WriterPreview() {
  const [saved, setSaved] = useState<PostEditorValue | null>(null), [revision, setRevision] = useState(0);
  return <><PostEditor key={revision} memberId="1" initialValue={saved ?? example()} onSave={async value => { setSaved(value); return "local"; }}/>{saved && <section style={{ margin: "32px auto", maxWidth: 900 }} aria-label="저장 결과"><button type="button" onClick={() => setRevision(n => n + 1)}>저장한 본문 다시 편집</button><p>서버로 전송하지 않는 개발용 미리보기입니다.</p><output aria-label="저장된 블록 종류">{saved.blocks.map(block => block.type).join(", ")}</output><PostBody blocks={saved.blocks}/></section>}</>;
}

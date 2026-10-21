import test from "node:test";
import assert from "node:assert/strict";
import {getSchema} from "@tiptap/core";
import {RichTextStarterKit} from "../src/features/post/rich-text-starter-kit.ts";
import {richContentHtml} from "../src/features/post/rich-content.ts";
import {htmlToMarkdown} from "../src/features/post/html-to-markdown.ts";

test("인라인 코드와 굵게·기울임은 적용 순서와 관계없이 함께 유지한다",()=>{
 const schema=getSchema([RichTextStarterKit]);
 const code=schema.marks.code.create(),bold=schema.marks.bold.create(),italic=schema.marks.italic.create();
 for(const marks of [code.addToSet([bold,italic]),bold.addToSet([code,italic])]) {
  assert.deepEqual(marks.map(m=>m.type.name).sort(),["bold","code","italic"]);
  const node=schema.text("JSONB",marks);
  assert.deepEqual(schema.nodeFromJSON(node.toJSON()).marks.map(m=>m.type.name).sort(),["bold","code","italic"]);
 }
});
test("코드가 섞인 마크다운 굵게 표시는 일반 HTML과 왕복 변환에서도 유지된다",()=>{
 const source="**정형 관계(FK)와 반정형 구조화 문서(`JSONB`)의 하이브리드 설계**";
 const html=richContentHtml(source,"MARKDOWN");
 assert.match(html,/<strong>.*<code>JSONB<\/code>.*<\/strong>/);
 const converted=htmlToMarkdown(html);
 assert.match(richContentHtml(converted,"MARKDOWN"),/<strong>.*<code>JSONB<\/code>.*<\/strong>/);
});

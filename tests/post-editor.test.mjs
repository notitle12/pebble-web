import test from "node:test";
import assert from "node:assert/strict";
import { buildPostBody, createEditorBlock, editorValueFromPost, validateEditorValue } from "../src/features/post/post-editor-model.ts";

const author = { id: "1", handle: "pebble-user", nickname: "Pebble", blogName: null };
const basePost = { id: "10", urlKey: "first-post", title: "첫 글", summary: null, author, tags: [], publishedAt: null, createdAt: "2026-10-03T00:00:00Z" };

test("editor conversion preserves block order, content and architecture coordinates", () => {
  const blocks = [
    { type: "TEXT", content: "안녕하세요 🌱", language: null, title: null, displayOrder: 0 },
    { type: "ARCHITECTURE", content: JSON.stringify({ schemaVersion: 1, groups: [], nodes: [{ id: "api", type: "APP", label: "API", position: { x: 317, y: 428 } }], edges: [] }), language: null, title: "구성", displayOrder: 1 },
  ];
  const value = editorValueFromPost({ ...basePost, blocks });
  const body = buildPostBody(value);
  assert.deepEqual(body.blocks.map(block => block.type), ["TEXT", "ARCHITECTURE"]);
  assert.equal(body.blocks[0].content, "안녕하세요 🌱");
  assert.deepEqual(JSON.parse(body.blocks[1].content).nodes[0].position, { x: 317, y: 428 });
  assert.deepEqual(validateEditorValue(value), []);
});

test("validation rejects invalid structured references and Unicode title overflow", () => {
  const block = createEditorBlock("ARCHITECTURE");
  block.content = JSON.stringify({ schemaVersion: 1, groups: [], nodes: [{ id: "api", type: "APP", label: "API", groupId: "missing" }], edges: [] });
  const value = { title: "🌋".repeat(201), summary: "", blocks: [block] };
  const errors = validateEditorValue(value);
  assert.ok(errors.some(error => error.includes("200자")));
  assert.ok(errors.some(error => error.includes("구조 블록")));
});

test("body omits editor-only keys while preserving optional block metadata", () => {
  const value = { title: "글", summary: "  요약  ", blocks: [{ ...createEditorBlock("CODE"), content: "const name = 'Pebble';", title: "예제", language: "TYPESCRIPT" }] };
  const body = buildPostBody(value);
  assert.deepEqual(body, { title: "글", summary: "  요약  ", blocks: [{ type: "CODE", content: "const name = 'Pebble';", language: "TYPESCRIPT", title: "예제" }] });
  assert.equal("key" in body.blocks[0], false);
  assert.equal("valid" in body.blocks[0], false);
});

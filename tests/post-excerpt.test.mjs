import test from "node:test";
import assert from "node:assert/strict";
import { derivePostExcerpt } from "../src/features/post/post-excerpt.ts";
import { buildPostBody, createEditorBlock } from "../src/features/post/post-editor-model.ts";

const block = (type, content) => ({ ...createEditorBlock(type), content });

test("extracts visible prose from HTML without attributes, code, scripts, or duplicated TOC text", () => {
  const result = derivePostExcerpt([block("HTML", '<p title="hidden > attribute">Hello <strong>world</strong> &amp; friends</p><nav class="post-toc"><h2>목차</h2><a>Repeated heading</a></nav><script>alert("secret")</script><pre>source code</pre>')]);
  assert.equal(result, "Hello world & friends");
});

test("renders Markdown through the existing sanitizer and excludes code, scripts, and structured payloads", () => {
  const architecture = JSON.stringify({ schemaVersion: 1, groups: [], nodes: [{ id: "api", type: "APP", label: "API > database" }], edges: [] });
  const markdown = `# 제목\n\n본문 **강조**와 [링크](https://example.test) 😀 with \`inline code\`\n\n<div data-pebble-type="ARCHITECTURE" data-pebble-spec='${architecture}'>diagram label should not be summary</div>\n\n<script>secret()</script>\n\n\`\`\`js\nsecret()\n\`\`\``;
  assert.equal(derivePostExcerpt([block("MARKDOWN", markdown)]), "제목 본문 강조와 링크 😀 with");
});

test("keeps TEXT readable and truncates by Unicode code points", () => {
  assert.equal(derivePostExcerpt([block("TEXT", "가😀나")], 2), "가😀");
  assert.equal(derivePostExcerpt([block("HTML", `<p>${"😀".repeat(220)}</p>`)]), "😀".repeat(200));
});

test("ignores structured and code blocks and returns null for empty readable content", () => {
  assert.equal(derivePostExcerpt([block("CODE", "plain looking source"), block("TABLE", JSON.stringify({ name: "table" })), block("ARCHITECTURE", JSON.stringify({ nodes: [{ label: "node" }] }))]), null);
  assert.equal(derivePostExcerpt([block("HTML", "<p><br></p>"), block("MARKDOWN", "```text\nhidden\n```")]), null);
});

test("save body derives summary while retaining legacy editor summary input", () => {
  const body = buildPostBody({ title: "Title", summary: "old manually entered summary", blocks: [block("TEXT", "Current body excerpt")] });
  assert.equal(body.summary, "Current body excerpt");
});

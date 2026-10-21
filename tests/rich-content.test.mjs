import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenStreetMapEmbed, buildTableOfContents, escapeRichText, isSafeOpenStreetMapEmbed, persistedRichHtml, richContentHtml, richEditorHtml } from "../src/features/post/rich-content.ts";

test("TEXT stays text and cannot create active HTML", () => {
  const output = richContentHtml("<script>alert(1)</script>\nplain", "TEXT");
  assert.doesNotMatch(output, /<script/i);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /plain/);
});

test("HTML and Markdown previews remove script, event handlers, unsafe schemes, and iframes", () => {
  for (const format of ["HTML", "MARKDOWN"]) {
    const source = `<img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><iframe src="https://evil.test"></iframe><script>alert(1)</script><details open><summary>More</summary><p>kept</p></details>`;
    const output = richContentHtml(source, format);
    assert.doesNotMatch(output, /onerror|javascript:|iframe|<script/i);
    assert.match(output, /<details open>/);
    assert.match(output, /kept/);
  }
});

test("Markdown basics render and embedded safe HTML survives the format round trip", () => {
  const output = richContentHtml("# Hello\n\n<strong>preserved</strong>\n\n- one\n- two", "MARKDOWN");
  assert.match(output, /<h1[^>]*>Hello<\/h1>/);
  assert.match(output, /<strong>preserved<\/strong>/);
  assert.match(output, /<li>one<\/li>/);
});

test("media previews are transient and saved HTML uses stable source", () => {
  const stable = "https://api.example.test/api/v1/media/asset-1";
  const preview = "https://images.example.test/asset-1?signature=short-lived";
  const editorHtml = richEditorHtml(`<p><img src="${stable}" alt="diagram"></p>`, "HTML", { [stable]: preview });
  assert.match(editorHtml, /src="https:\/\/images\.example\.test\/asset-1\?signature=short-lived"/);
  assert.match(editorHtml, /data-media-src="https:\/\/api\.example\.test\/api\/v1\/media\/asset-1"/);
  const saved = persistedRichHtml(editorHtml);
  assert.match(saved, new RegExp(`src="${stable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.doesNotMatch(saved, /signature=|data-media-src/);
});

test("unsafe normal and stable image sources cannot turn into active content", () => {
  for (const html of [
    '<img src="javascript:alert(1)" data-media-src="https://safe.test/image">',
    '<img src="https://safe.test/image" data-media-src="javascript:alert(1)" onerror="alert(1)">',
    '<p style="background-image:url(javascript:alert(1));color:red">x</p>',
  ]) {
    const output = persistedRichHtml(html);
    assert.doesNotMatch(output, /javascript:|onerror|background-image|data-media-src/i);
    assert.doesNotMatch(output, /<img[^>]*src=""/);
  }
});

test("only bounded OpenStreetMap coordinate embeds survive; other frames are removed", () => {
  const map = buildOpenStreetMapEmbed(37.5, 127);
  assert.ok(map);
  assert.equal(isSafeOpenStreetMapEmbed(map), true);
  const safe = richContentHtml(`<iframe src="${map}" title="ignored" sandbox="allow-scripts"></iframe>`, "HTML");
  assert.match(safe, /<iframe[^>]*src="https:\/\/www\.openstreetmap\.org\/export\/embed\.html/);
  assert.match(safe, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(safe, /title="지도: OpenStreetMap"/);
  assert.doesNotMatch(richContentHtml('<iframe src="https://evil.test/x"></iframe>', "HTML"), /<iframe/);
  assert.doesNotMatch(richContentHtml('<iframe src="https://www.openstreetmap.org/edit"></iframe>', "HTML"), /<iframe/);
  assert.equal(buildOpenStreetMapEmbed(91, 0), null);
});

test("TOC escapes text and anchors", () => {
  const toc = buildTableOfContents([{ id: 'x" onmouseover="alert(1)', text: "<img src=x>", level: 2 }]);
  assert.doesNotMatch(toc, /" onmouseover=/);
  assert.match(toc, /&lt;img src=x&gt;/);
  assert.match(toc, /&quot; onmouseover=&quot;/);
  assert.match(escapeRichText("<script>"), /&lt;script&gt;/);
  const safe = richContentHtml(toc, "HTML");
  assert.match(safe, /<nav[^>]*aria-label="목차"/);
  assert.match(safe, /data-level="2"/);
  assert.match(safe, /target="_self"/);
});

test("user markup cannot borrow application overlay classes",()=>{
 const safe=richContentHtml('<div class="writer-action-bar writer-identity" style="position:fixed;z-index:10000">text</div><nav class="post-toc writer-identity">toc</nav>',"HTML");
 assert.doesNotMatch(safe,/writer-action-bar|writer-identity|position:|z-index:/);
 assert.match(safe,/class="post-toc"/);
});

test("Markdown headings require a space and one newline renders a line break", () => {
  const result = richContentHtml("### 제목\n\n###제목아님\n\n첫 줄\n둘째 줄\n\n1. 하나\n2. 둘", "MARKDOWN");
  assert.match(result, /<h3[^>]*>제목<\/h3>/);
  assert.match(result, /###제목아님/);
  assert.match(result, /첫 줄<br\s*\/?>(?:\n)?둘째 줄/);
  assert.match(result, /<ol>/);
  assert.match(result, /<li>둘<\/li>/);
});
test("toggle summary and content survive persistence without introducing an editable summary paragraph", () => {
 const source='<details open><summary>세부 &amp; 내용</summary><div data-details-content><p>첫 줄<br>둘째 줄</p></div></details>';
 const result=persistedRichHtml(source);
 assert.match(result,/<summary>세부 &amp; 내용<\/summary>/);
 assert.match(result,/data-details-content/);
 assert.match(result,/<p>첫 줄<br\s*\/?>(?:\n)?둘째 줄<\/p>/);
});

test('local image previews are editor-only and stable references persist',()=>{
 const src='https://pebble.local.invalid/images/example';
 const edited=richEditorHtml(`<img src="${src}">`,'HTML',{[src]:'blob:local-owned'});
 assert.match(edited,/src="blob:local-owned"/);
 assert.match(persistedRichHtml(edited),/src="https:\/\/pebble.local.invalid\/images\/example"/);
 assert.doesNotMatch(richContentHtml('<img src="blob:untrusted">','HTML'),/src="blob:/);
});
test('image and HTML table alignment survive sanitization while invalid alignment is removed',()=>{
 const safe=richContentHtml('<img src="https://images.example/photo.png" data-align="center"><table data-align="right"><tbody><tr><td>x</td></tr></tbody></table><img src="https://images.example/other.png" data-align="fixed">','HTML');
 assert.match(safe,/<img[^>]*data-align="center"/);
 assert.match(safe,/<table[^>]*data-align="right"/);
 assert.doesNotMatch(safe,/data-align="fixed"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown, blocksToHtml, blocksToMarkdown } from '../src/features/post/html-to-markdown.ts';
import { richContentHtml } from '../src/features/post/rich-content.ts';

test('HTML headings convert to Markdown headings #, ##, ###', () => {
  const html = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '# Heading 1\n\n## Heading 2\n\n### Heading 3');
});

test('Inline styling converts to Markdown bold, italic, strike, and inline code', () => {
  const html = '<p><strong>Bold text</strong> and <em>Italic text</em> and <s>Strikethrough</s> and <code>const x = 1;</code></p>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '**Bold text** and *Italic text* and ~~Strikethrough~~ and `const x = 1;`');
});

test('Inline code preserves Markdown punctuation and embedded backticks', () => {
  const md = htmlToMarkdown('<p><code>a*b _c_ and `ticks`</code></p>');
  assert.equal(md, '`` a*b _c_ and `ticks` ``');
  assert.match(richContentHtml(md, 'MARKDOWN'), /<code>a\*b _c_ and `ticks`<\/code>/);
});

test('Links and images convert to Markdown syntax', () => {
  const html = '<p>Visit <a href="https://pebble.work">Pebble</a> or see <img src="/media/display.webp" alt="Cover" data-media-src="/media/display.webp"></p>';
  const md = htmlToMarkdown(html);
  assert.equal(md, 'Visit [Pebble](<https://pebble.work>) or see ![Cover](</media/display.webp>)');
});

test('Literal Markdown punctuation stays literal in text and list items', () => {
  const md = htmlToMarkdown('<p>*literal* _under_ [text] # heading</p><ul><li>- starts with dash</li><li>1. starts with number</li></ul>');
  assert.equal(md, '\\*literal\\* \\_under\\_ \\[text\\] \\# heading\n\n- \\- starts with dash\n- 1\\. starts with number');
  const rendered = richContentHtml(md, 'MARKDOWN');
  assert.match(rendered, /\*literal\* _under_ \[text\] # heading/);
  assert.match(rendered, /<li>\- starts with dash<\/li>/);
  assert.match(rendered, /<li>1\. starts with number<\/li>/);
  assert.doesNotMatch(rendered, /<em>|<strong>/);
});

test('Link and image labels and destinations escape Markdown delimiters', () => {
  const md = htmlToMarkdown('<p><a href="https://example.test/a b_(c)">A [label]</a> <img src="https://example.test/a b_(c).png" alt="A [cover]"></p>');
  assert.equal(md, '[A \\[label\\]](<https://example.test/a%20b_(c)>) ![A \\[cover\\]](<https://example.test/a%20b_(c).png>)');
  const rendered = richContentHtml(md, 'MARKDOWN');
  assert.match(rendered, /href="https:\/\/example\.test\/a%20b_\(c\)"/);
  assert.match(rendered, /src="https:\/\/example\.test\/a%20b_\(c\)\.png"/);
  assert.match(rendered, />A \[label\]<\/a>/);
});

test('Lists convert to Markdown unordered and ordered lists including nesting', () => {
  const html = `
    <ul>
      <li>Item A</li>
      <li>Item B
        <ul>
          <li>Sub 1</li>
          <li>Sub 2</li>
        </ul>
      </li>
      <li>Item C</li>
    </ul>
    <ol>
      <li>First</li>
      <li>Second</li>
    </ol>
  `;
  const md = htmlToMarkdown(html);
  assert.equal(md, '- Item A\n- Item B\n  - Sub 1\n  - Sub 2\n- Item C\n\n1. First\n2. Second');
});

test('Code blocks preserve language and code content', () => {
  const html = '<pre data-language="TYPESCRIPT"><code>const a = 1;\nconsole.log(a);</code></pre>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '```TYPESCRIPT\nconst a = 1;\nconsole.log(a);\n```');
});

test('Code block fence grows past embedded backtick runs', () => {
  const md = htmlToMarkdown('<pre data-language="TYPESCRIPT"><code>const text = ```\ninside\n```;</code></pre>');
  assert.equal(md, '````TYPESCRIPT\nconst text = ```\ninside\n```;\n````');
  assert.match(richContentHtml(md, 'MARKDOWN'), /const text = ```\ninside\n```;/);
});

test('Code blocks with class="language-python" fallback detect language', () => {
  const html = '<pre><code class="language-python">def hello():\n    return "hi"</code></pre>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '```python\ndef hello():\n    return "hi"\n```');
});

test('Aligned code blocks retain Pebble language and alignment attributes', () => {
  const html = '<pre data-language="PYTHON" data-align="center"><code>print("hello")</code></pre>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '<pre data-language="PYTHON" data-align="center"><code>print("hello")</code></pre>');
  const rendered = richContentHtml(md, 'MARKDOWN');
  assert.match(rendered, /<pre data-language="PYTHON" data-align="center">/);
  assert.match(rendered, /<code>print\("hello"\)<\/code>/);
});

test('Blockquotes prefix with >', () => {
  const html = '<blockquote><p>First line<br>Second line</p></blockquote>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '> First line\n> Second line');
});

test('Tables convert to GFM tables with column alignment', () => {
  const html = `
    <table>
      <thead>
        <tr><th>Name</th><th style="text-align: center">Score</th><th style="text-align: right">Rank</th></tr>
      </thead>
      <tbody>
        <tr><td>Alice</td><td>100</td><td>1</td></tr>
        <tr><td>Bob</td><td>85</td><td>2</td></tr>
      </tbody>
    </table>
  `;
  const md = htmlToMarkdown(html);
  assert.equal(md, '| Name | Score | Rank |\n| --- | :---: | ---: |\n| Alice | 100 | 1 |\n| Bob | 85 | 2 |');
});

test('Table cells escape Markdown punctuation and pipe delimiters', () => {
  const md = htmlToMarkdown('<table><thead><tr><th>*literal*</th><th>Column</th></tr></thead><tbody><tr><td># heading</td><td>a|b</td></tr></tbody></table>');
  assert.equal(md, '| \\*literal\\* | Column |\n| --- | --- |\n| \\# heading | a\\|b |');
  const rendered = richContentHtml(md, 'MARKDOWN');
  assert.match(rendered, /<th>\*literal\*<\/th>/);
  assert.match(rendered, /<td># heading<\/td>/);
  assert.match(rendered, /<td>a\|b<\/td>/);
  assert.doesNotMatch(rendered, /<em>|<strong>/);
});

test('Details/toggle blocks are preserved with summary and content', () => {
  const html = '<details open><summary>접는 글 제목</summary><div><p>상세 내용입니다.</p></div></details>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '<details open>\n<summary>접는 글 제목</summary><div><p>상세 내용입니다.</p></div></details>');
});

test('Automatic TOC stays in its validated HTML marker for editor atom parsing', () => {
  const toc = '<nav class="post-toc" aria-label="목차"><h2>목차</h2><ol><li data-level="2"><a href="#heading-1">Heading *one*</a></li></ol></nav>';
  const md = htmlToMarkdown(toc);
  assert.equal(md, '<nav class="post-toc" aria-label="목차"><h2>목차</h2><ol><li data-level="2"><a href="#heading-1">Heading *one*</a></li></ol></nav>');
  assert.match(richContentHtml(md, 'MARKDOWN'), /<nav class="post-toc" aria-label="목차">/);
});

test('Pebble custom spec blocks (TABLE, ARCHITECTURE, DB_SCHEMA) are preserved', () => {
  const spec = '{"schemaVersion":1,"tableName":"users"}';
  const html = `<div data-pebble-type="TABLE" data-pebble-spec="${spec.replaceAll('"', '&quot;')}" data-align="center"></div>`;
  const md = htmlToMarkdown(html);
  assert.match(md, /data-pebble-type="TABLE"/);
  assert.match(md, /data-align="center"/);
});

test('Removes obsolete Pebble HTML comment markers', () => {
  const html = '<!-- Pebble HTML content -->\n<h1>Title</h1><p>Body</p>';
  const md = htmlToMarkdown(html);
  assert.equal(md, '# Title\n\nBody');
  assert.doesNotMatch(md, /Pebble HTML content/);
});

test('blocksToMarkdown converts multiple heterogeneous blocks into a unified Markdown document', () => {
  const blocks = [
    { key: '1', type: 'HTML', content: '<h1>프로젝트 소개</h1><p>본문 내용</p>', language: null, title: null, valid: true },
    { key: '2', type: 'CODE', content: 'export const x = 1;', language: 'TYPESCRIPT', title: null, valid: true },
    { key: '3', type: 'TABLE', content: '{"schemaVersion":1,"tableName":"orders"}', language: null, title: null, valid: true },
  ];
  const md = blocksToMarkdown(blocks);
  assert.match(md, /^# 프로젝트 소개\n\n본문 내용/);
  assert.match(md, /```TYPESCRIPT\nexport const x = 1;\n```/);
  assert.match(md, /<div data-pebble-type="TABLE"/);
});

test('Bidirectional roundtrip: HTML -> Markdown -> HTML preserves readable structure', () => {
  const original = '<h1>제목</h1><p>이것은 <strong>굵은 글씨</strong>와 <em>기울임</em>입니다.</p><ul><li>항목 1</li><li>항목 2</li></ul>';
  const md = htmlToMarkdown(original);
  assert.equal(md, '# 제목\n\n이것은 **굵은 글씨**와 *기울임*입니다\\.\n\n- 항목 1\n- 항목 2');
  const roundtripHtml = richContentHtml(md, 'MARKDOWN');
  assert.match(roundtripHtml, /<h1>제목<\/h1>/);
  assert.match(roundtripHtml, /<strong>굵은 글씨<\/strong>/);
  assert.match(roundtripHtml, /<em>기울임<\/em>/);
  assert.match(roundtripHtml, /<li>항목 1<\/li>/);
  assert.match(roundtripHtml, /<li>항목 2<\/li>/);
});

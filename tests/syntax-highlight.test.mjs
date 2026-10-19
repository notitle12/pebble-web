import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenizeCode, normalizeLanguage, formatLanguageLabel } from "../src/features/post/syntax-highlight.ts";

test("언어 식별자 정규화 및 포맷팅", () => {
  assert.equal(normalizeLanguage("ts"), "typescript");
  assert.equal(normalizeLanguage("TYPESCRIPT"), "typescript");
  assert.equal(normalizeLanguage("py"), "python");
  assert.equal(normalizeLanguage("postgres"), "sql");
  assert.equal(normalizeLanguage(null), "text");

  assert.equal(formatLanguageLabel("ts"), "TypeScript");
  assert.equal(formatLanguageLabel("py"), "Python");
  assert.equal(formatLanguageLabel("sql"), "SQL");
  assert.equal(formatLanguageLabel(null), "Code");
});

test("JavaScript/TypeScript 구문 토큰화: 키워드, 함수, 문자열, 숫자, 주석", () => {
  const code = `// 주석 테스트
const message: string = "Hello World";
function calculateTotal(count: number) {
  return count * 10;
}`;
  const tokens = tokenizeCode(code, "typescript");
  const types = tokens.filter(t => t.type !== null).map(t => [t.type, t.text]);

  assert.deepEqual(types[0], ["comment", "// 주석 테스트"]);
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "const"));
  assert.ok(types.some(([type, text]) => type === "string" && text === '"Hello World"'));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "function"));
  assert.ok(types.some(([type, text]) => type === "function" && text === "calculateTotal"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "return"));
  assert.ok(types.some(([type, text]) => type === "number" && text === "10"));
});

test("Python 구문 토큰화: def, self, 주석, 삼중따옴표", () => {
  const code = `# Python sample
def greet(self, name: str):
    """Docstring"""
    return f"Hello {name}"`;
  const tokens = tokenizeCode(code, "python");
  const types = tokens.filter(t => t.type !== null).map(t => [t.type, t.text]);

  assert.deepEqual(types[0], ["comment", "# Python sample"]);
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "def"));
  assert.ok(types.some(([type, text]) => type === "function" && text === "greet"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "self"));
  assert.ok(types.some(([type, text]) => type === "string" && text === '"""Docstring"""'));
});

test("SQL 구문 토큰화: SELECT, FROM, WHERE, 대소문자 무관", () => {
  const code = `-- SQL sample
SELECT id, nickname, created_at
FROM member
WHERE status = 'ACTIVE' AND id > 100;`;
  const tokens = tokenizeCode(code, "sql");
  const types = tokens.filter(t => t.type !== null).map(t => [t.type, t.text]);

  assert.deepEqual(types[0], ["comment", "-- SQL sample"]);
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "SELECT"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "FROM"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "WHERE"));
  assert.ok(types.some(([type, text]) => type === "string" && text === "'ACTIVE'"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "AND"));
  assert.ok(types.some(([type, text]) => type === "number" && text === "100"));
});

test("일반 텍스트 언어는 토큰 분할 없이 원문 유지", () => {
  const code = "Plain text without code syntax";
  const tokens = tokenizeCode(code, null);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, null);
  assert.equal(tokens[0].text, code);
});

test("Java 구문 토큰화: 키워드, 어노테이션, 클래스명, 메서드, 문자열", () => {
  const code = `@Service
public class UserService {
  @Override
  public String findName(Long id) {
    // 조회 로직
    return "User" + id;
  }
}`;
  const tokens = tokenizeCode(code, "java");
  const types = tokens.filter(t => t.type !== null).map(t => [t.type, t.text]);

  assert.ok(types.some(([type, text]) => type === "annotation" && text === "@Service"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "public"));
  assert.ok(types.some(([type, text]) => type === "keyword" && text === "class"));
  assert.ok(types.some(([type, text]) => type === "class-name" && text === "UserService"));
  assert.ok(types.some(([type, text]) => type === "annotation" && text === "@Override"));
  assert.ok(types.some(([type, text]) => type === "class-name" && text === "String"));
  assert.ok(types.some(([type, text]) => type === "function" && text === "findName"));
  assert.ok(types.some(([type, text]) => type === "class-name" && text === "Long"));
  assert.ok(types.some(([type, text]) => type === "comment" && text === "// 조회 로직"));
  assert.ok(types.some(([type, text]) => type === "string" && text === '"User"'));
});

test("HTML 코드 블록 하이라이팅: data-language 및 class=language- 처리", async () => {
  const { highlightHtmlCodeBlocks } = await import("../src/features/post/syntax-highlight.ts");
  const inputHtml = `<p>본문 설명</p><pre data-language="JAVA"><code>public class Main {\n  public static void main(String[] args) {}\n}</code></pre>`;
  const output = highlightHtmlCodeBlocks(inputHtml);

  assert.ok(output.includes('<span class="hl-keyword">public</span>'));
  assert.ok(output.includes('<span class="hl-keyword">class</span>'));
  assert.ok(output.includes('<span class="hl-class-name">Main</span>'));
  assert.ok(output.includes('<span class="hl-function">main</span>'));
  assert.ok(output.includes('<span class="hl-class-name">String</span>'));
});

test("하이라이팅은 공격 문자열을 실행 가능한 HTML로 바꾸지 않고 텍스트를 유지한다", async () => {
  const {highlightHtmlCodeBlocks} = await import('../src/features/post/syntax-highlight.ts');
  const {richContentHtml} = await import('../src/features/post/rich-content.ts');
  const input = '<pre data-language="javascript"><code>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;한글&quot;</code></pre>';
  const output = highlightHtmlCodeBlocks(richContentHtml(input, 'HTML'));
  assert.ok(!output.includes('<img'));
  assert.ok(output.includes('&lt;'));
  assert.ok(output.includes('&amp;'));
  assert.equal(tokenizeCode('const 한글 = "😀";\n// 주석', 'typescript').map(t=>t.text).join(''), 'const 한글 = "😀";\n// 주석');
});

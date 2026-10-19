import type { ReactNode } from "react";
import React from "react";

export type TokenType =
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "function"
  | "class-name"
  | "operator"
  | "punctuation"
  | "boolean"
  | "property"
  | "variable"
  | "annotation";

export interface Token {
  type: TokenType | null;
  text: string;
}

const COMMON_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "default", "break", "continue", "import", "export", "from", "as",
  "default", "class", "extends", "implements", "interface", "type", "enum",
  "public", "private", "protected", "static", "final", "abstract", "readonly",
  "new", "this", "super", "instanceof", "typeof", "void", "delete", "throw",
  "try", "catch", "finally", "async", "await", "yield", "package", "namespace"
]);

const JAVA_KEYWORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
  "const", "continue", "default", "do", "double", "else", "enum", "extends", "final",
  "finally", "float", "for", "goto", "if", "implements", "import", "instanceof",
  "int", "interface", "long", "native", "new", "package", "private", "protected",
  "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized",
  "this", "throw", "throws", "transient", "try", "void", "volatile", "while",
  "record", "sealed", "permits", "non-sealed", "var"
]);

const PYTHON_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield", "self", "cls"
]);

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "insert", "into", "values", "update", "set", "delete",
  "create", "table", "drop", "alter", "add", "column", "primary", "key", "foreign",
  "references", "join", "inner", "left", "right", "full", "outer", "cross", "on",
  "group", "by", "order", "having", "limit", "offset", "as", "and", "or", "not",
  "is", "null", "in", "between", "like", "exists", "union", "all", "distinct",
  "case", "when", "then", "end", "asc", "desc", "count", "sum", "avg", "min", "max",
  "index", "view", "trigger", "constraint", "check", "unique", "default", "cascade"
]);

const BOOLEANS = new Set(["true", "false", "True", "False", "TRUE", "FALSE"]);
const NULLS = new Set(["null", "undefined", "nil", "None", "NULL"]);

export function normalizeLanguage(lang: string | null | undefined): string {
  if (!lang) return "text";
  const cleaned = lang.trim().toLowerCase();
  switch (cleaned) {
    case "js":
    case "javascript":
      return "javascript";
    case "ts":
    case "typescript":
      return "typescript";
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
    case "java":
      return "java";
    case "py":
    case "python":
      return "python";
    case "sql":
    case "postgres":
    case "postgresql":
    case "mysql":
      return "sql";
    case "html":
    case "htm":
    case "xml":
    case "svg":
      return "html";
    case "css":
    case "scss":
    case "sass":
      return "css";
    case "json":
      return "json";
    case "sh":
    case "bash":
    case "zsh":
    case "shell":
      return "bash";
    case "go":
    case "golang":
      return "go";
    case "rs":
    case "rust":
      return "rust";
    case "yml":
    case "yaml":
      return "yaml";
    case "md":
    case "markdown":
      return "markdown";
    default:
      return cleaned;
  }
}

export function formatLanguageLabel(lang: string | null | undefined): string {
  if (!lang) return "Code";
  const normalized = normalizeLanguage(lang);
  switch (normalized) {
    case "typescript": return "TypeScript";
    case "javascript": return "JavaScript";
    case "tsx": return "TSX";
    case "jsx": return "JSX";
    case "java": return "Java";
    case "python": return "Python";
    case "sql": return "SQL";
    case "html": return "HTML";
    case "css": return "CSS";
    case "json": return "JSON";
    case "bash": return "Bash";
    case "go": return "Go";
    case "rust": return "Rust";
    case "yaml": return "YAML";
    case "markdown": return "Markdown";
    default: return lang.toUpperCase();
  }
}

export function tokenizeCode(code: string, language: string | null): Token[] {
  const norm = normalizeLanguage(language);
  if (norm === "text") {
    return [{ type: null, text: code }];
  }

  const isSql = norm === "sql";
  const isPython = norm === "python" || norm === "bash" || norm === "yaml";

  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // 1. Line comments
    if ((ch === "/" && code[i + 1] === "/") || (isPython && ch === "#") || (isSql && ch === "-" && code[i + 1] === "-")) {
      const start = i;
      while (i < len && code[i] !== "\n") i++;
      tokens.push({ type: "comment", text: code.slice(start, i) });
      continue;
    }

    // 2. Block comments: /* ... */
    if (ch === "/" && code[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < len && !(code[i] === "*" && code[i + 1] === "/")) i++;
      if (i < len) i += 2;
      tokens.push({ type: "comment", text: code.slice(start, i) });
      continue;
    }

    // 3. Strings: ", ', `
    if (ch === '"' || ch === "'" || (ch === "`" && !isSql)) {
      const quote = ch;
      const start = i;
      i++;
      const isTriple = isPython && (code.slice(start, start + 3) === '"""' || code.slice(start, start + 3) === "'''");
      if (isTriple) {
        i += 2;
        const triple = code.slice(start, start + 3);
        while (i < len && code.slice(i, i + 3) !== triple) {
          if (code[i] === "\\") i += 2;
          else i++;
        }
        if (i < len) i += 3;
      } else {
        while (i < len && code[i] !== quote) {
          if (code[i] === "\\") i += 2;
          else if (code[i] === "\n" && quote !== "`") break;
          else i++;
        }
        if (i < len && code[i] === quote) i++;
      }
      tokens.push({ type: "string", text: code.slice(start, i) });
      continue;
    }

    // 4. Java / Spring annotations: @Override, @Service, etc.
    if (ch === "@" && i + 1 < len && /[a-zA-Z]/.test(code[i + 1])) {
      const start = i;
      i++;
      while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) i++;
      tokens.push({ type: "annotation", text: code.slice(start, i) });
      continue;
    }

    // 5. Numbers
    if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < len && code[i + 1] >= "0" && code[i + 1] <= "9")) {
      const prevCh = i > 0 ? code[i - 1] : " ";
      if (!/[a-zA-Z_$]/.test(prevCh)) {
        const start = i;
        if (code.slice(start, start + 2).toLowerCase() === "0x") {
          i += 2;
          while (i < len && /[0-9a-fA-F]/.test(code[i])) i++;
        } else {
          while (i < len && /[0-9.eE_+-]/.test(code[i])) {
            if ((code[i] === "+" || code[i] === "-") && code[i - 1].toLowerCase() !== "e") break;
            i++;
          }
        }
        while (i < len && /[a-zA-Z]/.test(code[i])) i++;
        tokens.push({ type: "number", text: code.slice(start, i) });
        continue;
      }
    }

    // 6. Words / Identifiers
    if (/[a-zA-Z_$]/.test(ch) || (ch >= "\u0080" && !/[.,;:!?()[\]{}<>=+\-*/%&|^~]/.test(ch))) {
      const start = i;
      while (i < len && (/[a-zA-Z0-9_$]/.test(code[i]) || (code[i] >= "\u0080" && !/[.,;:!?()[\]{}<>=+\-*/%&|^~]/.test(code[i])))) {
        i++;
      }
      const word = code.slice(start, i);
      const lower = word.toLowerCase();

      const isKeyword =
        (norm === "java" ? JAVA_KEYWORDS.has(word) :
         isSql ? SQL_KEYWORDS.has(lower) :
         norm === "python" ? PYTHON_KEYWORDS.has(word) :
         COMMON_KEYWORDS.has(word));

      if (isKeyword) {
        tokens.push({ type: "keyword", text: word });
      } else if (BOOLEANS.has(word) || NULLS.has(word)) {
        tokens.push({ type: "boolean", text: word });
      } else {
        let peek = i;
        while (peek < len && (code[peek] === " " || code[peek] === "\t")) peek++;
        if (peek < len && code[peek] === "(") {
          tokens.push({ type: "function", text: word });
        } else if (/^[A-Z][a-zA-Z0-9_$]*$/.test(word) && !isSql) {
          tokens.push({ type: "class-name", text: word });
        } else {
          tokens.push({ type: null, text: word });
        }
      }
      continue;
    }

    // 7. Operators & Punctuation
    if (/[+\-*/%&|^~!=<>?:]/.test(ch)) {
      tokens.push({ type: "operator", text: ch });
      i++;
      continue;
    }

    if (/[{}()[\];.,]/.test(ch)) {
      tokens.push({ type: "punctuation", text: ch });
      i++;
      continue;
    }

    // Default: whitespace or other character
    tokens.push({ type: null, text: ch });
    i++;
  }

  const merged: Token[] = [];
  for (const t of tokens) {
    if (merged.length > 0 && merged[merged.length - 1].type === t.type) {
      merged[merged.length - 1].text += t.text;
    } else {
      merged.push({ ...t });
    }
  }

  return merged;
}

export function highlightCodeToReact(code: string, language: string | null): ReactNode[] {
  const tokens = tokenizeCode(code, language);
  return tokens.map((token, index) => {
    if (!token.type) {
      return token.text;
    }
    return React.createElement(
      "span",
      { key: index, className: `hl-${token.type}` },
      token.text
    );
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function highlightHtmlCodeBlocks(html: string): string {
  if (!html || !html.includes("<pre")) return html;

  return html.replace(
    /<pre\b([^>]*)>(?:<code\b([^>]*)>([\s\S]*?)<\/code>|([\s\S]*?))<\/pre>/gi,
    (_match, preAttrs, codeAttrs, innerWithCode, innerDirect) => {
      const innerCode = innerWithCode !== undefined ? innerWithCode : innerDirect;
      const codeAttributes = codeAttrs || "";
      const langMatch =
        preAttrs.match(/data-language=["']([^"']+)["']/i) ||
        codeAttributes.match(/class=["'][^"']*language-([a-z0-9_-]+)[^"']*["']/i) ||
        preAttrs.match(/class=["'][^"']*language-([a-z0-9_-]+)[^"']*["']/i);
      const rawLang = langMatch ? langMatch[1] : null;
      const lang = normalizeLanguage(rawLang);

      const rawCode = unescapeHtml(stripTags(innerCode));
      const tokens = tokenizeCode(rawCode, lang);

      const highlightedHtml = tokens
        .map(t => (t.type ? `<span class="hl-${t.type}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text)))
        .join("");

      return `<pre${preAttrs}><code${codeAttributes}>${highlightedHtml}</code></pre>`;
    }
  );
}

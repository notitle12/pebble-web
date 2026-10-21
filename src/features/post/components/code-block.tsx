"use client";
import { useState } from "react";
import { formatLanguageLabel, highlightCodeToReact } from "../syntax-highlight";

export function CodeBlock({ content, language, title }: { content: string; language: string | null; title: string | null }) {
  const [message, setMessage] = useState("");
  const langLabel = formatLanguageLabel(language);
  const highlighted = highlightCodeToReact(content, language);

  return (
    <section className="code-block" aria-label={title ?? `${langLabel} 코드 예제`}>
      <div className="code-heading">
        <div className="code-heading-left">
          {language && <span className="code-lang-badge">{langLabel}</span>}
          <span>{title ?? (!language ? "코드" : "")}</span>
        </div>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(content); setMessage("복사했어요."); } catch { setMessage("복사하지 못했어요. 코드를 직접 선택해 주세요."); }
        }}>코드 복사</button>
      </div>
      <pre tabIndex={0} aria-label="코드 내용" data-language={language ?? undefined}><code>{highlighted}</code></pre>
      {message && <p className="copy-status" role="status">{message}</p>}
    </section>
  );
}

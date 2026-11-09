"use client";
import { useState } from "react";
import { formatLanguageLabel, highlightCodeToReact } from "../syntax-highlight";
import { MermaidPreview } from "./mermaid-preview";
import { readMermaidSource } from "../mermaid-source";
import { DiagramWidthFrame } from "./diagram-width-frame";
import styles from "./mermaid-preview.module.css";

export function CodeBlock({ content, language, title }: { content: string; language: string | null; title: string | null }) {
  const [message, setMessage] = useState("");
  const langLabel = formatLanguageLabel(language);
  const highlighted = highlightCodeToReact(content, language);

  if (language?.toUpperCase() === "MERMAID") {
    const { source, width } = readMermaidSource(content);
    return <DiagramWidthFrame width={width}><section className="code-block" aria-label={title ?? "Mermaid 다이어그램"}>
      {title && <h2>{title}</h2>}
      <MermaidPreview source={source}/>
      <details className={styles.readerSource}><summary>코드 보기</summary><pre tabIndex={0}><code>{source}</code></pre></details>
    </section></DiagramWidthFrame>;
  }

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

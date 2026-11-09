import {addThemeColorsToSanitizedHtml} from "../theme-text-rendering";
import {NestedRichContent} from "./nested-rich-content";
import {richContentHtml} from "../rich-content";
import {highlightHtmlCodeBlocks} from "../syntax-highlight";

// 사용자 소스는 항상 동일 허용 목록으로 정제한 결과만 표시한다.
export function RichContentBlock({content,format,title,imagePreviews}:{content:string;format:"HTML"|"MARKDOWN";title?:string|null;imagePreviews?:Record<string,string>}) {
  const html=addThemeColorsToSanitizedHtml(highlightHtmlCodeBlocks(richContentHtml(content,format,imagePreviews)));
  const renderBlocks=html.includes("data-pebble-type=") || /(?:data-language="mermaid"|class="[^"<>]*\blanguage-mermaid\b)/i.test(html);
  return <section className="post-rich-content">{title&&<h2>{title}</h2>}{renderBlocks?<div className="post-prose"><NestedRichContent html={html}/></div>:<div className="post-prose" dangerouslySetInnerHTML={{__html:html}}/>}</section>;
}

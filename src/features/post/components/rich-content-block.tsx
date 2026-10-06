import {richContentHtml} from "../rich-content";

// 사용자 소스는 항상 동일 허용 목록으로 정제한 결과만 표시한다.
export function RichContentBlock({content,format,title}:{content:string;format:"HTML"|"MARKDOWN";title?:string|null}) {
  const html=richContentHtml(content,format);
  return <section className="post-rich-content">{title&&<h2>{title}</h2>}<div dangerouslySetInnerHTML={{__html:html}}/></section>;
}

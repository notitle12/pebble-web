import {parseArchitectureSpec,parseTableSpec,type PostBlock} from "../api/post-list";
import {RichContentBlock} from "./rich-content-block";
import {CodeBlock} from "./code-block";
import {TableBlock} from "./table-block";
import {ArchitectureBlock} from "./architecture-block";
export function PostBody({blocks}:{blocks:(Pick<PostBlock,"type"|"content"|"language"|"title"> & {alignment?:PostBlock["alignment"]})[]}){
  return <div className="post-body">{blocks.map((block,index)=><div key={index} data-block-alignment={block.alignment ?? "LEFT"}>{block.type==="CODE"
    ? <CodeBlock key={index} content={block.content} title={block.title} language={block.language}/>
    : block.type==="HTML" || block.type==="MARKDOWN" ? <RichContentBlock key={index} content={block.content} format={block.type} title={block.title}/>
    : block.type==="TABLE" ? <TableBlock key={index} spec={parseTableSpec(JSON.parse(block.content))} title={block.title}/>
    : block.type==="ARCHITECTURE" ? <ArchitectureBlock key={index} spec={parseArchitectureSpec(JSON.parse(block.content))} title={block.title}/>
    : <section className="text-block">{block.title&&<h2>{block.title}</h2>}<p>{block.content}</p></section>}</div>)}</div>;
}

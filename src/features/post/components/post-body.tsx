import {parseDatabaseSchema} from "../database-schema";
import {DatabaseSchemaBlock} from "./database-schema-block";
import {parseArchitectureSpec,parseTableSpec,type PostBlock} from "../api/post-list";
import {RichContentBlock} from "./rich-content-block";
import {CodeBlock} from "./code-block";
import {TableBlock} from "./table-block";
import {ArchitectureBlock} from "./architecture-block";
export function PostBody({blocks,imagePreviews}:{imagePreviews?:Record<string,string>;blocks:(Pick<PostBlock,"type"|"content"|"language"|"title"> & {alignment?:PostBlock["alignment"]})[]}){
  return <div className="post-body">{blocks.map((block,index)=><div key={index} data-block-alignment={block.alignment ?? "LEFT"}>{block.type==="CODE"
    ? <CodeBlock key={index} content={block.content} title={block.title} language={block.language}/>
    : block.type==="HTML" || block.type==="MARKDOWN" ? <RichContentBlock key={index} imagePreviews={imagePreviews} content={block.content} format={block.type} title={block.title}/>
    : block.type==="DB_SCHEMA" ? (() => { try { return <DatabaseSchemaBlock key={index} schema={parseDatabaseSchema(JSON.parse(block.content))} title={block.title}/>; } catch { return <p>이 블록을 표시할 수 없습니다.</p>; } })()
    : block.type==="TABLE" ? (() => { try { return <TableBlock key={index} spec={parseTableSpec(JSON.parse(block.content))} title={block.title}/>; } catch { return <p>이 블록을 표시할 수 없습니다.</p>; } })()
    : block.type==="ARCHITECTURE" ? (() => { try { return <ArchitectureBlock key={index} spec={parseArchitectureSpec(JSON.parse(block.content))} title={block.title}/>; } catch { return <p>이 블록을 표시할 수 없습니다.</p>; } })()
    : <section className="text-block">{block.title&&<h2>{block.title}</h2>}<p>{block.content}</p></section>}</div>)}</div>;
}

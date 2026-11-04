import {createElement,type CSSProperties,type ReactNode} from 'react';
import {parseDocument} from 'htmlparser2';
import {Element,Text,type ChildNode} from 'domhandler';
import {parseArchitectureSpec,parseTableSpec} from '../api/post-list';
import {parseDatabaseSchema} from '../database-schema';
import {TableBlock} from './table-block';
import {ArchitectureBlock} from './architecture-block';
import {DatabaseSchemaBlock} from './database-schema-block';
const propertyNames:Record<string,string>={class:'className',colspan:'colSpan',rowspan:'rowSpan',allowfullscreen:'allowFullScreen',referrerpolicy:'referrerPolicy'};
function properties(attrs:Record<string,string>){
 const props:Record<string,unknown>={};
 for(const [name,value] of Object.entries(attrs)){
  if(name==='style'){
   const styles:Record<string,string>={};
   for(const declaration of value.split(';')){const split=declaration.indexOf(':');if(split<0)continue;const key=declaration.slice(0,split).trim();styles[key.startsWith('--')?key:key.replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())]=declaration.slice(split+1).trim();}
   props.style=styles as CSSProperties;
  }else props[propertyNames[name]??name]=['open','allowfullscreen'].includes(name)?true:value;
 }
 return props;
}
/** Receives the same sanitized HTML as the ordinary reader, with generated theme variables. */
export function NestedRichContent({html}:{html:string}){
 const render=(nodes:ChildNode[],path='root'):ReactNode[]=>nodes.map((node,index)=>{
  const key=`${path}.${index}`;
  if(node instanceof Text)return node.data;
  if(!(node instanceof Element))return null;
  const type=node.name==='div'?node.attribs['data-pebble-type']:undefined;
  if(type){
   try{
    const spec=JSON.parse(node.attribs['data-pebble-spec']??''),title=node.attribs['data-pebble-title'];
    const content=type==='TABLE'?<TableBlock spec={parseTableSpec(spec)} title={title}/>:type==='ARCHITECTURE'?<ArchitectureBlock spec={parseArchitectureSpec(spec)} title={title}/>:type==='DB_SCHEMA'?<DatabaseSchemaBlock schema={parseDatabaseSchema(spec)} title={title}/>:null;
    return <div key={key} data-align={node.attribs['data-align']}>{content}</div>;
   }catch{return <p key={key}>이 블록을 표시할 수 없습니다.</p>;}
  }
  const props={...properties(node.attribs),key};
  return ['img','br','hr','col'].includes(node.name)?createElement(node.name,props):createElement(node.name,props,...render(node.children,key));
 });
 return <>{render(parseDocument(html).children)}</>;
}

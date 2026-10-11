"use client";
import {NodeViewWrapper,useEditorState,type NodeViewProps} from '@tiptap/react';
import {newDatabaseSchema,parseDatabaseSchema,type DatabaseSchema} from '../database-schema';
import {DatabaseSchemaBlock} from './database-schema-block';
import {DatabaseSchemaEditor} from './database-schema-editor';
import s from './database-schema.module.css';
export function InlineDatabaseSchema({node,editor,updateAttributes,deleteNode}:NodeViewProps){
 const editable=useEditorState({editor,selector:({editor})=>editor.isEditable});
 const spec:DatabaseSchema=node.attrs.spec??newDatabaseSchema();
 let valid=false;try{parseDatabaseSchema(spec);valid=true;}catch{}
 return <NodeViewWrapper className={s.node} contentEditable={false} data-align={node.attrs.align??'left'} onPointerDown={(e:React.PointerEvent)=>e.stopPropagation()} onKeyDown={(e:React.KeyboardEvent)=>e.stopPropagation()}>
  {editable?<><div className={s.nodeHeading}><span>DB 설계</span><button type="button" aria-label="DB 설계 블록 삭제" onClick={()=>deleteNode()}>삭제</button></div><DatabaseSchemaEditor initialTab={node.attrs.editorTab} value={spec} onChange={next=>{if(!editor.isEditable)return;let valid=false;try{parseDatabaseSchema(next);valid=true;}catch{}updateAttributes({spec:next,valid});}}/></>:valid?<DatabaseSchemaBlock schema={spec} title={node.attrs.title}/>:<p>DB 설계를 완성해 주세요.</p>}
 </NodeViewWrapper>;
}

"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {NodeViewWrapper,useEditorState,type NodeViewProps} from '@tiptap/react';
import {newDatabaseSchema,parseDatabaseSchema,type DatabaseSchema} from '../database-schema';
import {DatabaseSchemaBlock} from './database-schema-block';
import {DatabaseSchemaEditor} from './database-schema-editor';
import s from './database-schema.module.css';
export function InlineDatabaseSchema({node,editor,updateAttributes,deleteNode}:NodeViewProps){
 const editable=useEditorState({editor,selector:({editor})=>editor.isEditable});
 const spec:DatabaseSchema=node.attrs.spec??newDatabaseSchema();
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null),heading=useId();
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<DatabaseSchema|null>(null);
 let valid:DatabaseSchema|null=null;try{valid=parseDatabaseSchema(spec);}catch{}
 useEffect(()=>{if(open&&editable)dialog.current?.showModal();else dialog.current?.close();},[open,editable]);
 const close=()=>{setOpen(false);dialog.current?.close();opener.current?.focus();};
 return <NodeViewWrapper className={s.node} contentEditable={false} data-align={node.attrs.align??'left'} onPointerDown={(e:React.PointerEvent)=>e.stopPropagation()} onKeyDown={(e:React.KeyboardEvent)=>e.stopPropagation()}>
  <div className={s.nodeHeading}><span>DB 설계</span><div><button type="button" ref={opener} disabled={!editable} onClick={()=>{setDraft(valid);setOpen(true);}}>DB 설계 편집</button><button type="button" aria-label="DB 설계 블록 삭제" disabled={!editable} onClick={()=>deleteNode()}>삭제</button></div></div>
  {valid?<DatabaseSchemaBlock schema={valid} title={node.attrs.title}/>:<p className={s.help}>ERD 또는 명세서에서 테이블과 컬럼을 작성해 주세요.</p>}
  {open&&createPortal(<dialog ref={dialog} className={s.dialog} aria-labelledby={heading} onCancel={e=>{e.preventDefault();close();}} onClose={()=>setOpen(false)} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><header><h2 id={heading}>DB 설계</h2><button type="button" aria-label="DB 설계 편집 닫기" onClick={close}>×</button></header><DatabaseSchemaEditor initialTab={node.attrs.editorTab} initialValue={spec} onChange={setDraft}/><footer><button type="button" onClick={close}>취소</button><button type="button" disabled={!editable||!draft} onClick={()=>{if(!editor.isEditable||!draft)return;updateAttributes({spec:parseDatabaseSchema(draft),valid:true});close();}}>적용</button></footer></dialog>,document.body)}
 </NodeViewWrapper>;
}

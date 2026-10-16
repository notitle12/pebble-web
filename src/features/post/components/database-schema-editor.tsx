"use client";
import {useId,useState} from 'react';
import {newDbColumn,newDbTable,parseDatabaseSchema,removeDbColumn,removeDbTable,updateDbColumn,type DatabaseSchema,type DbReference} from '../database-schema';
import {connectDbColumns,type DbRelationShape} from '../database-relationship-choice';
import {DatabaseNotationPicker,DatabaseRelationShapePicker} from './database-notation-picker';
import {DatabaseDiagram} from './database-schema-block';
import {DatabaseColumnTable,DatabaseTableFooter,type DatabaseEditActions} from './database-edit-table';
import {TableTextInput} from './inline-block-views';
import s from './database-schema.module.css';
export function DatabaseSchemaEditor({value,onChange,initialTab='ERD'}:{value:DatabaseSchema;initialTab?:'ERD'|'SPEC';onChange:(schema:DatabaseSchema)=>void}){
 const schema=value,id=useId();
 const [tab,setTab]=useState<'ERD'|'SPEC'>(initialTab),[connecting,setConnecting]=useState(false),[from,setFrom]=useState<DbReference|null>(null),[message,setMessage]=useState('');
 const [notation,setNotation]=useState<'IE'|'CHEN'>('IE'),[shape,setShape]=useState<DbRelationShape>({many:true,targetRequired:true,sourceRequired:false});
 let error='';try{parseDatabaseSchema(schema);}catch(e){error=e instanceof Error?e.message:'입력값을 확인해 주세요.';}
 const update=(next:DatabaseSchema)=>onChange(next);
 const connect=(ref:DbReference)=>{
  if(!connecting)return;
  if(!from){
   const table=schema.tables.find(t=>t.id===ref.tableId),target=table?.columns.find(c=>c.id===ref.columnId);
   if(!target||!(target.unique||target.primaryKey&&table!.columns.filter(c=>c.primaryKey).length===1)){setMessage('처음에는 1쪽의 단일 PK 또는 UNIQUE 컬럼을 선택해 주세요.');return;}
   setFrom(ref);setMessage('다음으로 FK가 될 컬럼의 화살표를 눌러 주세요.');return;
  }
  try{update(connectDbColumns(schema,from,ref,shape,notation));}catch(e){setMessage(e instanceof Error?e.message:'연결할 컬럼을 확인해 주세요.');return;}
  setFrom(null);setConnecting(false);setMessage('관계를 연결했어요. FK 옆에서 관계선을 다시 설정할 수 있어요.');
 };
 const actions:DatabaseEditActions={
  changeTable:(id,patch)=>update({...schema,tables:schema.tables.map(t=>t.id===id?{...t,...patch}:t)}),
  changeColumn:(tableId,columnId,patch)=>update(updateDbColumn(schema,tableId,columnId,patch)),
  addColumn:id=>update({...schema,tables:schema.tables.map(t=>t.id===id&&t.columns.length<50?{...t,columns:[...t.columns,newDbColumn()]}:t)}),
  removeColumn:(tableId,columnId)=>{update(removeDbColumn(schema,tableId,columnId));setFrom(null);},
  removeTable:id=>{update(removeDbTable(schema,id));setFrom(null);},connect,connecting,
 };
 return <div className={s.editor}>
  <div className={s.editorHeading}><div className={s.tabs} role="tablist" aria-label="DB 설계 편집 방식"><button id={`${id}-erd`} type="button" role="tab" aria-selected={tab==='ERD'} aria-controls={`${id}-panel`} onClick={()=>setTab('ERD')}>ERD</button><button id={`${id}-spec`} type="button" role="tab" aria-selected={tab==='SPEC'} aria-controls={`${id}-panel`} onClick={()=>{setTab('SPEC');setConnecting(false);setFrom(null);}}>테이블 명세서</button></div><button type="button" disabled={schema.tables.length>=20} onClick={()=>update({...schema,tables:[...schema.tables,newDbTable(schema.tables.length)]})}>＋ 테이블 추가</button><label>본문 표시<select aria-label="DB 설계 본문 표시" value={schema.display} onChange={e=>update({...schema,display:e.target.value as DatabaseSchema['display']})}><option value="BOTH">ERD + 테이블 선택 시 상세</option><option value="ERD">ERD만</option><option value="SPEC">명세서만</option></select></label></div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab==='ERD'?'erd':'spec'}`}>
   {tab==='ERD'?<>
    <div className={s.diagramActions}><button type="button" aria-pressed={connecting} onClick={()=>{setConnecting(v=>!v);setFrom(null);setMessage('');}}>{connecting?'관계 연결 취소':'관계 연결'}</button><button type="button" onClick={()=>update({...schema,tables:schema.tables.map((t,i)=>({...t,position:{x:32+(i%Math.ceil(Math.sqrt(schema.tables.length)))*340,y:32+Math.floor(i/Math.ceil(Math.sqrt(schema.tables.length)))*(180+Math.max(...schema.tables.map(k=>k.columns.length))*32)}}))})}>자동 배치</button><span>표에서 바로 입력하고 ⠿ 핸들을 드래그해 배치하세요.</span></div>
    {connecting&&<div className={s.connectOptions}><DatabaseNotationPicker value={notation} onChange={setNotation}/><DatabaseRelationShapePicker value={shape} notation={notation} onChange={setShape}/><p role="status">{message||'선 모양을 고르고 1쪽의 PK·UNIQUE 컬럼 → FK 컬럼 순서로 화살표를 눌러 주세요.'}</p></div>}
    <DatabaseDiagram schema={schema} actions={actions}/>
   </>:<div className={s.editSpecifications}>{schema.tables.map((t,i)=><section key={t.id} aria-label={`${t.name||'새 테이블'} 테이블 명세 편집`}><header className={s.specHeading}><TableTextInput aria-label={`테이블 ${i+1} 이름`} value={t.name} maxLength={100} placeholder="테이블명" onCommit={name=>actions.changeTable(t.id,{name})}/><button type="button" disabled={schema.tables.length<=1} aria-label={`${t.name||'새 테이블'} 테이블 삭제`} onClick={()=>actions.removeTable(t.id)}>테이블 삭제</button></header><DatabaseColumnTable schema={schema} table={t} actions={actions}/><DatabaseTableFooter schema={schema} table={t} actions={actions}/></section>)}</div>}
  </div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
 </div>;
}

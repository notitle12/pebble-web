"use client";
import {useId,useState} from 'react';
import {newDbColumn,newDbTable,parseDatabaseSchema,removeDbColumn,removeDbTable,updateDbColumn,type DatabaseSchema,type DbReference} from '../database-schema';
import {connectDbColumns,relationShapeLabel,type DbRelationShape} from '../database-relationship-choice';
import {DatabaseNotationPicker,DatabaseRelationShapePicker} from './database-notation-picker';
import {DatabaseDiagram} from './database-schema-block';
import {DatabaseColumnTable,DatabaseTableFooter,type DatabaseEditActions} from './database-edit-table';
import {TableTextInput} from './inline-block-views';
import s from './database-schema.module.css';
export function DatabaseSchemaEditor({value,onChange,initialTab='ERD'}:{value:DatabaseSchema;initialTab?:'ERD'|'SPEC';onChange:(schema:DatabaseSchema)=>void}){
 const schema=value,id=useId();
 const [tab,setTab]=useState<'ERD'|'SPEC'>(initialTab),[connecting,setConnecting]=useState(false),[from,setFrom]=useState<DbReference|null>(null),[message,setMessage]=useState(''),[selectedTable,setSelectedTable]=useState<string|null>(null),[foreign,setForeign]=useState<DbReference|null>(null);
 const [notation,setNotation]=useState<'IE'|'CHEN'>('IE'),[shape,setShape]=useState<DbRelationShape>({many:true,targetRequired:true,sourceRequired:false});
 let error='';try{parseDatabaseSchema(schema);}catch(e){error=e instanceof Error?e.message:'입력값을 확인해 주세요.';}
 const update=(next:DatabaseSchema)=>onChange(next);
 const finishConnection=(one:DbReference,fk:DbReference)=>{
  try{update(connectDbColumns(schema,one,fk,shape,notation));}catch(e){setMessage(e instanceof Error?e.message:'연결할 컬럼을 확인해 주세요.');return;}
  setFrom(null);setForeign(null);setConnecting(false);setMessage('관계를 연결했습니다. 선이나 관계 목록을 선택하면 양쪽 컬럼을 확인할 수 있습니다.');
 };
 const connect=(ref:DbReference)=>{
  if(!from){
   const table=schema.tables.find(t=>t.id===ref.tableId),target=table?.columns.find(c=>c.id===ref.columnId);
   if(!target||!(target.unique||target.primaryKey&&table!.columns.filter(c=>c.primaryKey).length===1)){setMessage('참조할 단일 PK 또는 UNIQUE 컬럼에서 연결을 시작해 주세요.');return;}
   setConnecting(true);setFrom(ref);setMessage('다음으로 FK 컬럼의 연결점을 선택하거나 아래에서 FK를 고르세요.');return;
  }
  finishConnection(from,ref);
 };
 const references=schema.tables.flatMap(t=>t.columns.filter(c=>c.unique||c.primaryKey&&t.columns.filter(k=>k.primaryKey).length===1).map(c=>({value:`${t.id}/${c.id}`,label:`${t.name||'새 테이블'}.${c.name||'새 컬럼'}`})));
 const foreigns=schema.tables.flatMap(t=>t.columns.map(c=>({value:`${t.id}/${c.id}`,label:`${t.name||'새 테이블'}.${c.name||'새 컬럼'}`}))).filter(item=>item.value!==`${from?.tableId}/${from?.columnId}`);
 const parseRef=(value:string):DbReference|null=>{if(!value)return null;const [tableId,columnId]=value.split('/');return {tableId,columnId};};
 const editTable=schema.tables.find(t=>t.id===selectedTable);
 const actions:DatabaseEditActions={
  changeTable:(id,patch)=>update({...schema,tables:schema.tables.map(t=>t.id===id?{...t,...patch}:t)}),
  changeColumn:(tableId,columnId,patch)=>update(updateDbColumn(schema,tableId,columnId,patch)),
  addColumn:id=>update({...schema,tables:schema.tables.map(t=>t.id===id&&t.columns.length<50?{...t,columns:[...t.columns,newDbColumn()]}:t)}),
  removeColumn:(tableId,columnId)=>{update(removeDbColumn(schema,tableId,columnId));setFrom(null);},
  removeTable:id=>{update(removeDbTable(schema,id));setFrom(null);setSelectedTable(null);},connect,connectPair:finishConnection,connecting,
 };
 return <div className={s.editor} onKeyDown={event=>{if(event.key==='Escape'&&connecting){event.stopPropagation();setConnecting(false);setFrom(null);setForeign(null);setMessage('관계 추가를 취소했습니다.');}}}>
  <div className={s.editorHeading}><div className={s.tabs} role="tablist" aria-label="DB 설계 편집 방식"><button id={`${id}-erd`} type="button" role="tab" aria-selected={tab==='ERD'} aria-controls={`${id}-panel`} onClick={()=>setTab('ERD')}>ERD</button><button id={`${id}-spec`} type="button" role="tab" aria-selected={tab==='SPEC'} aria-controls={`${id}-panel`} onClick={()=>{setTab('SPEC');setConnecting(false);setFrom(null);}}>테이블 명세서</button></div><button type="button" disabled={schema.tables.length>=20} onClick={()=>{const table=newDbTable(schema.tables.length);update({...schema,tables:[...schema.tables,table]});setSelectedTable(table.id);}}>＋ 테이블 추가</button><label>본문 표시<select aria-label="DB 설계 본문 표시" value={schema.display} onChange={e=>update({...schema,display:e.target.value as DatabaseSchema['display']})}><option value="BOTH">ERD + 테이블 선택 시 상세</option><option value="ERD">ERD만</option><option value="SPEC">명세서만</option></select></label></div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab==='ERD'?'erd':'spec'}`}>
   {tab==='ERD'?<>
    <div className={s.diagramActions}><button type="button" aria-pressed={connecting} onClick={()=>{setConnecting(v=>!v);setFrom(null);setForeign(null);setMessage('');}}>{connecting?'관계 추가 취소':'관계 추가'}</button><button type="button" onClick={()=>update({...schema,tables:schema.tables.map((t,i)=>({...t,position:{x:32+(i%Math.ceil(Math.sqrt(schema.tables.length)))*340,y:32+Math.floor(i/Math.ceil(Math.sqrt(schema.tables.length)))*(180+Math.max(...schema.tables.map(k=>k.columns.length))*32)}}))})}>자동 배치</button><span>테이블 이름을 눌러 편집 · ⠿ 이동 · PK 연결점을 FK 컬럼으로 드래그</span></div>
    {connecting&&<div className={s.connectOptions}>
     <div className={s.relationForm}><label>참조할 PK · UNIQUE<select aria-label="참조할 PK 또는 UNIQUE" value={from?`${from.tableId}/${from.columnId}`:''} onChange={event=>{setFrom(parseRef(event.target.value));setForeign(null);}}><option value="">컬럼 선택</option>{references.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><span aria-hidden="true">→</span><label>FK 컬럼<select aria-label="연결할 FK 컬럼" value={foreign?`${foreign.tableId}/${foreign.columnId}`:''} onChange={event=>setForeign(parseRef(event.target.value))}><option value="">컬럼 선택</option>{foreigns.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="button" disabled={!from||!foreign} onClick={()=>{if(from&&foreign)finishConnection(from,foreign);}}>관계 만들기</button></div>
     <details><summary>관계 설정 · {relationShapeLabel(shape)}</summary><DatabaseNotationPicker value={notation} onChange={setNotation}/><DatabaseRelationShapePicker value={shape} notation={notation} onChange={setShape}/></details>
    </div>}
    {message&&<p role="status" className={s.help}>{message}</p>}
    <DatabaseDiagram schema={schema} actions={actions} selectedTable={editTable?.id} onSelectTable={id=>setSelectedTable(current=>current===id?null:id)} onClearSelection={()=>setSelectedTable(null)}/>
    {editTable?<section className={s.selectedEditor} aria-label={`${editTable.name||'새 테이블'} 테이블 편집`}><header className={s.specHeading}><TableTextInput aria-label="선택한 테이블 이름" value={editTable.name} maxLength={100} placeholder="테이블명" onCommit={name=>actions.changeTable(editTable.id,{name})}/><button type="button" onClick={()=>setSelectedTable(null)}>편집 닫기</button><button type="button" disabled={schema.tables.length<=1} onClick={()=>actions.removeTable(editTable.id)}>테이블 삭제</button></header><DatabaseColumnTable schema={schema} table={editTable} actions={actions}/><DatabaseTableFooter schema={schema} table={editTable} actions={actions}/></section>:<p className={s.help}>테이블 이름을 선택하면 이름·컬럼·관계를 편집할 수 있습니다. 관계선을 선택하면 해당 컬럼이 강조됩니다.</p>}

   </>:<div className={s.editSpecifications}>{schema.tables.map((t,i)=><section key={t.id} aria-label={`${t.name||'새 테이블'} 테이블 명세 편집`}><header className={s.specHeading}><TableTextInput aria-label={`테이블 ${i+1} 이름`} value={t.name} maxLength={100} placeholder="테이블명" onCommit={name=>actions.changeTable(t.id,{name})}/><button type="button" disabled={schema.tables.length<=1} aria-label={`${t.name||'새 테이블'} 테이블 삭제`} onClick={()=>actions.removeTable(t.id)}>테이블 삭제</button></header><DatabaseColumnTable schema={schema} table={t} actions={actions}/><DatabaseTableFooter schema={schema} table={t} actions={actions}/></section>)}</div>}
  </div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
 </div>;
}

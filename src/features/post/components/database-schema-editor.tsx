"use client";
import {useEffect,useState} from 'react';
import {newDbColumn,newDbTable,parseDatabaseSchema,removeDbColumn,removeDbTable,updateDbColumn,type DatabaseSchema,type DbReference,type DbTable} from '../database-schema';
import {DatabaseDiagram,DatabaseSpecifications} from './database-schema-block';
import {TableTextInput} from './inline-block-views';
import s from './database-schema.module.css';
export function DatabaseSchemaEditor({initialValue,onChange,initialTab='ERD'}:{initialValue:DatabaseSchema;initialTab?:'ERD'|'SPEC';onChange:(schema:DatabaseSchema|null)=>void}){
 const [schema,setSchema]=useState(initialValue),[tab,setTab]=useState<'ERD'|'SPEC'>(initialTab),[selected,setSelected]=useState(initialValue.tables[0]?.id),[connecting,setConnecting]=useState(false),[from,setFrom]=useState<DbReference|null>(null),[message,setMessage]=useState('');
 let error='';try{parseDatabaseSchema(schema);}catch(e){error=e instanceof Error?e.message:'입력값을 확인해 주세요.';}
 useEffect(()=>onChange(error?null:schema),[schema,error,onChange]);
 const current=schema.tables.find(t=>t.id===selected)??schema.tables[0];
 const changeTable=(id:string,patch:Partial<DbTable>)=>setSchema(v=>({...v,tables:v.tables.map(t=>t.id===id?{...t,...patch}:t)}));
 const addColumn=(id:string)=>setSchema(v=>({...v,tables:v.tables.map(t=>t.id===id&&t.columns.length<50?{...t,columns:[...t.columns,newDbColumn()]}:t)}));
 const targets=schema.tables.flatMap(t=>t.columns.filter(c=>c.unique||c.primaryKey&&t.columns.filter(k=>k.primaryKey).length===1).map(c=>({table:t,column:c})));
 const connect=(ref:DbReference)=>{
  if(!connecting)return;
  if(!from){setFrom(ref);setMessage('참조 대상 PK 또는 UNIQUE 컬럼을 선택하세요.');return;}
  if(ref.tableId===from.tableId&&ref.columnId===from.columnId){setMessage('다른 컬럼을 참조 대상으로 선택하세요.');return;}
  if(!targets.some(t=>t.table.id===ref.tableId&&t.column.id===ref.columnId)){setMessage('참조 대상은 단일 PK 또는 UNIQUE 컬럼이어야 해요.');return;}
  setSchema(v=>updateDbColumn(v,from.tableId,from.columnId,{reference:ref}));setFrom(null);setConnecting(false);setMessage('외래 키를 연결했어요. 명세서에도 함께 반영됐어요.');
 };
 function inspector(){if(!current)return null;return <section className={s.inspector} aria-label="선택한 테이블 편집"><h3>테이블 정보</h3>
  <label>테이블명<TableTextInput aria-label="테이블명" value={current.name} maxLength={100} placeholder="테이블명을 입력하세요" onCommit={name=>changeTable(current.id,{name})}/></label>
  <label>테이블 설명<TableTextInput aria-label="테이블 설명" value={current.description} maxLength={500} placeholder="선택 사항" onCommit={description=>changeTable(current.id,{description})}/></label>
  <div className={s.checks}><button type="button" disabled={current.columns.length>=50} onClick={()=>addColumn(current.id)}>컬럼 추가</button><button type="button" className={s.delete} disabled={schema.tables.length<=1} onClick={()=>{setSchema(v=>removeDbTable(v,current.id));setFrom(null);}}>테이블 삭제</button></div>
  {current.columns.map((c,i)=><fieldset className={s.columnEditor} key={c.id}><legend>컬럼 {i+1}</legend>
   <label>컬럼명<TableTextInput aria-label={`컬럼 ${i+1} 이름`} maxLength={100} value={c.name} placeholder="컬럼명" onCommit={name=>setSchema(v=>updateDbColumn(v,current.id,c.id,{name}))}/></label>
   <label>자료형<TableTextInput aria-label={`컬럼 ${i+1} 자료형`} maxLength={100} value={c.dataType} placeholder="예: BIGINT" onCommit={dataType=>setSchema(v=>updateDbColumn(v,current.id,c.id,{dataType}))}/></label>
   <div className={s.checks}><label><input type="checkbox" aria-label={`컬럼 ${i+1} PK`} checked={c.primaryKey} onChange={e=>setSchema(v=>updateDbColumn(v,current.id,c.id,{primaryKey:e.target.checked}))}/>PK</label><label><input type="checkbox" aria-label={`컬럼 ${i+1} UNIQUE`} checked={c.unique} onChange={e=>setSchema(v=>updateDbColumn(v,current.id,c.id,{unique:e.target.checked}))}/>UNIQUE</label><label><input type="checkbox" aria-label={`컬럼 ${i+1} NULL 허용`} disabled={c.primaryKey} checked={c.nullable} onChange={e=>setSchema(v=>updateDbColumn(v,current.id,c.id,{nullable:e.target.checked}))}/>NULL 허용</label></div>
   <label>외래 키 참조<select aria-label={`컬럼 ${i+1} 외래 키 참조`} value={c.reference?JSON.stringify(c.reference):''} onChange={e=>setSchema(v=>updateDbColumn(v,current.id,c.id,{reference:e.target.value?JSON.parse(e.target.value):null}))}><option value="">참조 없음</option>{targets.filter(t=>t.table.id!==current.id||t.column.id!==c.id).map(t=><option key={`${t.table.id}-${t.column.id}`} value={JSON.stringify({tableId:t.table.id,columnId:t.column.id})}>{t.table.name||'새 테이블'}.{t.column.name||'새 컬럼'}</option>)}</select></label>
   <label>컬럼 설명<TableTextInput aria-label={`컬럼 ${i+1} 설명`} value={c.description} maxLength={500} placeholder="선택 사항" onCommit={description=>setSchema(v=>updateDbColumn(v,current.id,c.id,{description}))}/></label>
   <button type="button" className={s.delete} aria-label={`컬럼 ${i+1} 삭제`} disabled={current.columns.length<=1} onClick={()=>{setSchema(v=>removeDbColumn(v,current.id,c.id));setFrom(null);}}>컬럼 삭제</button>
  </fieldset>)}
 </section>;}
 return <div className={s.editor}>
  <div className={s.editorHeading}><button type="button" disabled={schema.tables.length>=20} onClick={()=>{const t=newDbTable(schema.tables.length);setSchema(v=>({...v,tables:[...v.tables,t]}));setSelected(t.id);}}>＋ 테이블 추가</button><span>{schema.tables.length}/20</span><label>본문 표시<select aria-label="DB 설계 본문 표시" value={schema.display} onChange={e=>setSchema(v=>({...v,display:e.target.value as DatabaseSchema['display']}))}><option value="BOTH">ERD + 명세서</option><option value="ERD">ERD만</option><option value="SPEC">명세서만</option></select></label></div>
  <div className={s.tabs} role="tablist" aria-label="DB 설계 편집 방식"><button id="db-erd-tab" type="button" role="tab" aria-selected={tab==='ERD'} aria-controls="db-schema-panel" onClick={()=>setTab('ERD')}>ERD</button><button id="db-spec-tab" type="button" role="tab" aria-selected={tab==='SPEC'} aria-controls="db-schema-panel" onClick={()=>{setTab('SPEC');setConnecting(false);setFrom(null);}}>테이블 명세서</button></div>
  <p className={s.help}>두 화면은 같은 테이블과 컬럼을 편집해요. 이름을 바꿔도 관계는 유지돼요. 참조 대상은 단일 PK 또는 UNIQUE 컬럼이며, 테이블·컬럼 삭제나 참조 대상의 키 제약 해제 시 해당 참조도 함께 해제돼요.</p>
  <div className={s.tableList} aria-label="테이블 선택">{schema.tables.map((t,i)=><button type="button" key={t.id} aria-pressed={current?.id===t.id} onClick={()=>setSelected(t.id)}>{t.name||`새 테이블 ${i+1}`}</button>)}</div>
  <div id="db-schema-panel" role="tabpanel" aria-labelledby={tab==='ERD'?'db-erd-tab':'db-spec-tab'}>{tab==='ERD'?<>
   <div className={s.checks}><button type="button" aria-pressed={connecting} onClick={()=>{setConnecting(v=>!v);setFrom(null);setMessage(connecting?'관계 연결을 취소했어요.':'FK가 될 컬럼을 선택한 뒤 참조할 PK 또는 UNIQUE 컬럼을 선택하세요.');}}>{connecting?'관계 연결 취소':'관계 연결'}</button><button type="button" onClick={()=>setSchema(v=>({...v,tables:v.tables.map((t,i)=>({...t,position:{x:32+(i%Math.ceil(Math.sqrt(v.tables.length)))*340,y:32+Math.floor(i/Math.ceil(Math.sqrt(v.tables.length)))*(96+Math.max(...v.tables.map(k=>k.columns.length))*32)}}))}))}>자동 배치</button></div>
   <p role="status" className={s.help}>{message||'테이블을 선택해 정보를 편집하고 제목을 드래그해 배치하세요.'}</p>
   <div className={s.workspace}><DatabaseDiagram schema={schema} selected={current?.id} onSelect={setSelected} onMove={(id,x,y)=>changeTable(id,{position:{x,y}})} onColumn={connect} connecting={connecting} onAddColumn={addColumn}/>{inspector()}</div>
  </>:<div className={s.specEditor}>{inspector()}<DatabaseSpecifications schema={schema}/></div>}</div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
 </div>;
}

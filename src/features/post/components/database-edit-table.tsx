"use client";
import type {DatabaseSchema,DbColumn,DbReference,DbTable,DbNotation} from '../database-schema';
import {relationCardinality} from '../database-schema';
import {TableTextInput} from './inline-block-views';
import s from './database-schema.module.css';
export type DatabaseEditActions = {
 changeTable:(id:string,patch:Partial<DbTable>)=>void;
 changeColumn:(tableId:string,columnId:string,patch:Partial<DbColumn>)=>void;
 addColumn:(id:string)=>void;removeColumn:(tableId:string,columnId:string)=>void;removeTable:(id:string)=>void;
 connect?:(reference:DbReference)=>void;connecting?:boolean;
};
export function DatabaseColumnTable({schema,table,actions}:{schema:DatabaseSchema;table:DbTable;actions:DatabaseEditActions}){
 const targets=schema.tables.flatMap(t=>t.columns.filter(c=>c.unique||c.primaryKey&&t.columns.filter(k=>k.primaryKey).length===1).map(c=>({table:t,column:c})));
 return <div className={s.editTableScroll}><table className={s.editTable} aria-label={`${table.name||'새 테이블'} 컬럼 편집`}><thead><tr><th>컬럼</th><th>자료형</th><th>PK</th><th>FK · 참조</th><th>UQ</th><th>NULL</th><th>설명</th><th><span className={s.srOnly}>삭제</span></th></tr></thead><tbody>{table.columns.map((c,i)=>{
 const label=`${table.name||'새 테이블'} 컬럼 ${i+1}`,change=(patch:Partial<DbColumn>)=>actions.changeColumn(table.id,c.id,patch);
 return <tr key={c.id}>
  <td><TableTextInput aria-label={`${label} 이름`} value={c.name} maxLength={100} placeholder="컬럼명" onCommit={name=>change({name})}/></td>
  <td><TableTextInput aria-label={`${label} 자료형`} value={c.dataType} maxLength={100} placeholder="자료형" onCommit={dataType=>change({dataType})}/></td>
  <td><input type="checkbox" aria-label={`${label} PK`} checked={c.primaryKey} onChange={e=>change({primaryKey:e.target.checked})}/></td>
  <td><div className={s.fkCell}><select aria-label={`${label} FK 참조`} value={c.reference?`${c.reference.tableId}/${c.reference.columnId}`:''} onChange={e=>{const [tableId,columnId]=e.target.value.split('/');change({reference:e.target.value?{...c.reference,tableId,columnId}:null});}}><option value="">없음</option>{targets.filter(t=>t.table.id!==table.id||t.column.id!==c.id).map(t=><option key={`${t.table.id}/${t.column.id}`} value={`${t.table.id}/${t.column.id}`}>{t.table.name||'새 테이블'}.{t.column.name||'새 컬럼'}</option>)}</select>{actions.connecting&&<button type="button" aria-label={`${table.name||'새 테이블'}.${c.name||'새 컬럼'} 관계 연결`} onClick={()=>actions.connect?.({tableId:table.id,columnId:c.id})}>↗</button>}</div></td>
  <td><input type="checkbox" aria-label={`${label} UNIQUE`} checked={c.unique} onChange={e=>change({unique:e.target.checked})}/></td>
  <td><input type="checkbox" aria-label={`${label} NULL 허용`} checked={c.nullable} disabled={c.primaryKey} onChange={e=>change({nullable:e.target.checked})}/></td>
  <td><TableTextInput aria-label={`${label} 설명`} value={c.description} maxLength={500} placeholder="설명" onCommit={description=>change({description})}/></td>
  <td><button type="button" className={s.rowDelete} aria-label={`${label} 삭제`} disabled={table.columns.length<=1} onClick={()=>actions.removeColumn(table.id,c.id)}>×</button></td>
 </tr>;
 })}</tbody></table></div>;
}
export function DatabaseRelationControls({schema,table,actions}:{schema:DatabaseSchema;table:DbTable;actions:DatabaseEditActions}){
 return <div className={s.inlineRelations}>{table.columns.filter(c=>c.reference).map(c=>{
 const relation=relationCardinality(table,c),target=schema.tables.find(t=>t.id===c.reference!.tableId),targetColumn=target?.columns.find(k=>k.id===c.reference!.columnId);
 const change=(patch:Partial<DbColumn>)=>actions.changeColumn(table.id,c.id,patch);
 const refChange=(patch:Partial<DbReference>)=>change({reference:{...c.reference!,...patch}});
 return <details key={c.id}><summary>{c.name||'새 컬럼'} → {target?.name}.{targetColumn?.name} <span>관계선 설정 · {relation.many?'1:N':'1:1'}</span></summary><div className={s.relationFields}>
  <label>관계<select aria-label={`${table.name}.${c.name} 관계 유형`} value={relation.many?'MANY':'ONE'} onChange={e=>change({unique:e.target.value==='ONE'})}><option value="MANY" disabled={c.primaryKey&&table.columns.filter(k=>k.primaryKey).length===1}>1:N</option><option value="ONE">1:1</option></select></label>
  <label>참조 대상 연결<select aria-label={`${table.name}.${c.name} 참조 필수 여부`} disabled={c.primaryKey} value={c.nullable?'OPTIONAL':'REQUIRED'} onChange={e=>change({nullable:e.target.value==='OPTIONAL'})}><option value="REQUIRED">필수 (1)</option><option value="OPTIONAL">선택 (0..1)</option></select></label>
  <label>참조하는 행<select aria-label={`${table.name}.${c.name} 자식 필수 여부`} value={relation.sourceRequired?'REQUIRED':'OPTIONAL'} onChange={e=>refChange({sourceRequired:e.target.value==='REQUIRED'})}><option value="REQUIRED">필수 ({relation.many?'1..N':'1'})</option><option value="OPTIONAL">선택 ({relation.many?'0..N':'0..1'})</option></select></label>
  <label>표기법<select aria-label={`${table.name}.${c.name} 관계 표기법`} value={relation.notation} onChange={e=>refChange({notation:e.target.value as DbNotation})}><option value="IE">IE · 까마귀발</option><option value="BARKER">Barker · 실선/점선</option><option value="CHEN">숫자 · 1 / N</option></select></label>
  <button type="button" onClick={()=>change({reference:null})}>관계 해제</button>
 </div><p className={s.relationHint}>1:1은 이 FK에 UNIQUE를 적용해요. 참조 필수 여부는 NULL 허용과 연동돼요. 참조하는 행의 필수 여부는 설계 문서에 표시돼요.</p></details>;
 })}</div>;
}
export function DatabaseTableFooter({schema,table,actions}:{schema:DatabaseSchema;table:DbTable;actions:DatabaseEditActions}){return <>
 <div className={s.tableFooter}><button type="button" disabled={table.columns.length>=50} onClick={()=>actions.addColumn(table.id)}>＋ 컬럼 추가</button><span>{table.columns.length}/50</span><TableTextInput aria-label={`${table.name||'새 테이블'} 테이블 설명`} value={table.description} maxLength={500} placeholder="테이블 설명 (선택)" onCommit={description=>actions.changeTable(table.id,{description})}/></div>
 <DatabaseRelationControls schema={schema} table={table} actions={actions}/>
 </>;}

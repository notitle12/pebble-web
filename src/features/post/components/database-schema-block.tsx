"use client";
import {useLayoutEffect,useRef,useState} from 'react';
import type {DatabaseSchema} from '../database-schema';
import {databaseLinks,crowFootPaths,type DbSize} from '../database-relations';
import {DatabaseColumnTable,DatabaseTableFooter,type DatabaseEditActions} from './database-edit-table';
import {TableTextInput} from './inline-block-views';
import s from './database-schema.module.css';
function EndMark({x,y,angle,many,required,notation}:{x:number;y:number;angle:number;many:boolean;required:boolean;notation:string}){
 const radians=angle*Math.PI/180,nx=Math.round(Math.cos(radians)),ny=Math.round(Math.sin(radians));
 if(notation==='CHEN')return <text x={x+nx*14+(ny?12:0)} y={y+ny*18+(nx?-9:0)} textAnchor={nx<0?'end':'start'}>{many?'N':'1'}{required?'':'°'}</text>;
 const marker=crowFootPaths(0,0,1,many,required);
 return <g transform={`translate(${x} ${y}) rotate(${angle})`}><path d={marker.maximum}/>{marker.minimum&&<path d={marker.minimum}/>} {marker.circle&&<circle {...marker.circle}/>}</g>;
}
export function DatabaseDiagram({schema,actions}:{schema:DatabaseSchema;actions?:DatabaseEditActions}){
 const [zoom,setZoom]=useState(1),[moving,setMoving]=useState<{id:string;x:number;y:number}|null>(null);
 const drag=useRef<{id:string;px:number;py:number;x:number;y:number}|null>(null);
 const editable=!!actions,scale=editable?2.5:1,cardWidth=editable?660:280;
 const cards=useRef(new Map<string,HTMLElement>()),[sizes,setSizes]=useState<Record<string,DbSize>>({});
 const cardIds=schema.tables.map(t=>t.id).join(',');
 useLayoutEffect(()=>{
  const measure=()=>{const next=Object.fromEntries([...cards.current].map(([id,el])=>[id,{width:el.offsetWidth,height:el.offsetHeight}]));setSizes(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);};
  measure();const observer=new ResizeObserver(measure);cards.current.forEach(el=>observer.observe(el));return ()=>observer.disconnect();
 },[cardIds,editable]);
 const tables=schema.tables.map(t=>moving?.id===t.id?{...t,position:{x:moving.x,y:moving.y}}:t);
 const links=databaseLinks({...schema,tables},editable,sizes);
 const width=Math.max(800,...tables.map(t=>t.position.x*scale+cardWidth+80),...links.flatMap(l=>l.points.map(p=>p.x+40))),height=Math.max(420,...tables.map(t=>t.position.y*scale+(sizes[t.id]?.height??(editable?220:80)+t.columns.length*(editable?40:32))+80),...links.flatMap(l=>l.points.map(p=>p.y+40)));
 return <section className={s.diagram} aria-label="ERD 관계도">
  <div className={s.zoom}><span>테이블 {tables.length} · 관계 {links.length}</span><button type="button" aria-label="ERD 축소" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.1))}>−</button><output>{Math.round(zoom*100)}%</output><button type="button" aria-label="ERD 확대" disabled={zoom>=1.5} onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>＋</button><button type="button" onClick={()=>setZoom(1)}>100%</button></div>
  <div className={s.viewport} tabIndex={0} aria-label="ERD 스크롤 영역"><div style={{width:width*zoom,height:height*zoom}}><div className={s.world} style={{width,height,transform:`scale(${zoom})`}}>
   <svg width={width} height={height} className={s.lines} aria-label="외래 키 관계선">{links.map(l=><g key={l.id}><title>{l.label}</title><path d={l.d}/><EndMark x={l.source.x} y={l.source.y} angle={l.source.angle} many={l.many} required={l.sourceRequired} notation={l.notation}/><EndMark x={l.target.x} y={l.target.y} angle={l.target.angle} many={false} required={l.targetRequired} notation={l.notation}/></g>)}</svg>
   {tables.map((t,index)=><article key={t.id} ref={el=>{if(el)cards.current.set(t.id,el);else cards.current.delete(t.id);}} className={s.card} data-editable={editable} style={{width:cardWidth,left:t.position.x*scale,top:t.position.y*scale}}>
    {actions?<div className={s.editCardHeading}>
     <button type="button" className={s.dragHandle} aria-label={`${t.name||'새 테이블'} 이동`} onPointerDown={event=>{drag.current={id:t.id,px:event.clientX,py:event.clientY,x:t.position.x,y:t.position.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const d=drag.current;if(d?.id!==t.id)return;setMoving({id:t.id,x:Math.max(0,Math.min(6000,Math.round(d.x+(event.clientX-d.px)/zoom/scale))),y:Math.max(0,Math.min(6000,Math.round(d.y+(event.clientY-d.py)/zoom/scale)))});}} onPointerUp={event=>{const d=drag.current;if(d?.id!==t.id)return;drag.current=null;setMoving(null);actions.changeTable(t.id,{position:{x:Math.max(0,Math.min(6000,Math.round(d.x+(event.clientX-d.px)/zoom/scale))),y:Math.max(0,Math.min(6000,Math.round(d.y+(event.clientY-d.py)/zoom/scale)))}});}} onPointerCancel={()=>{drag.current=null;setMoving(null);}}>⠿</button>
     <TableTextInput aria-label={`테이블 ${index+1} 이름`} value={t.name} maxLength={100} placeholder="테이블명" onCommit={name=>actions.changeTable(t.id,{name})}/><button type="button" className={s.rowDelete} disabled={schema.tables.length<=1} aria-label={`${t.name||'새 테이블'} 테이블 삭제`} onClick={()=>actions.removeTable(t.id)}>×</button>
    </div>:<div className={s.cardHeading}><strong>{t.name}</strong></div>}
    {actions?<><DatabaseColumnTable schema={schema} table={t} actions={actions}/><DatabaseTableFooter schema={schema} table={t} actions={actions}/></>:t.columns.map(c=><div key={c.id} className={s.cardColumn}><span className={s.key}>{[c.primaryKey?'PK':'',c.reference?'FK':'',c.unique?'UQ':''].filter(Boolean).join('/')}</span><span>{c.name}</span><small>{c.dataType}</small></div>)}
   </article>)}
  </div></div></div>
  {links.length>0&&<details className={s.relations}><summary>관계 목록 ({links.length})</summary><ul>{links.map(l=><li key={l.id}>{l.label} <span>({l.sourceRequired?'1':'0'}..{l.many?'N':'1'} : {l.targetRequired?'1':'0..1'})</span></li>)}</ul></details>}
 </section>;
}
export function DatabaseSpecifications({schema}:{schema:DatabaseSchema}){return <div className={s.specifications}>{schema.tables.map(t=><section key={t.id} aria-label={`${t.name} 테이블 명세`}><h3>{t.name}</h3>{t.description&&<p>{t.description}</p>}<div className={s.specScroll} tabIndex={0}><table><caption>{t.name} 컬럼 명세</caption><thead><tr><th>컬럼</th><th>자료형</th><th>NULL</th><th>키</th><th>참조</th><th>설명</th></tr></thead><tbody>{t.columns.map(c=>{const target=schema.tables.find(t=>t.id===c.reference?.tableId),col=target?.columns.find(k=>k.id===c.reference?.columnId);return <tr key={c.id}><th scope="row">{c.name}</th><td>{c.dataType}</td><td>{c.nullable?'허용':'불가'}</td><td>{[c.primaryKey?'PK':'',c.unique?'UQ':'',c.reference?'FK':''].filter(Boolean).join(' · ')}</td><td>{target&&col?`${target.name}.${col.name}`:''}</td><td>{c.description}</td></tr>;})}</tbody></table></div></section>)}</div>;}
export function DatabaseSchemaBlock({schema,title}:{schema:DatabaseSchema;title:string|null}){return <section className={s.block} aria-label={title||'DB 설계'}>{title&&<h2>{title}</h2>}{schema.display!=='SPEC'&&<DatabaseDiagram schema={schema}/>} {schema.display!=='ERD'&&<DatabaseSpecifications schema={schema}/>}</section>;}

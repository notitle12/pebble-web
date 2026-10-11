"use client";
import { useRef, useState, type PointerEvent } from "react";
import { TECH_STACK_GROUPS, reorderTechStacks, techStackKey } from "../tech-stack-catalog";
export function TechStackPicker({value, disabled, onChange}: {value: string[]; disabled: boolean; onChange: (next: string[]) => void}) {
  const [query,setQuery]=useState("");
  const [dragging,setDragging]=useState<string|null>(null), [over,setOver]=useState<string|null>(null), [notice,setNotice]=useState("");
  const source=useRef<string|null>(null);
  const selected=new Set(value.map(techStackKey));
  function targetAt(event: PointerEvent) { return document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-stack-name]")?.dataset.stackName??null; }
  function move(name: string,target: string) { onChange(reorderTechStacks(value,name,target)); setNotice(`${name} 위치를 변경했어요.`); }
  function toggle(name: string) { if(disabled)return; const key=techStackKey(name); if(selected.has(key))onChange(value.filter(item=>techStackKey(item)!==key)); else if(value.length<20)onChange([...value,name]); }
  const groups=TECH_STACK_GROUPS.map(group=>({...group,names:group.names.filter(name=>techStackKey(name).includes(techStackKey(query)))})).filter(group=>group.names.length);
  return <fieldset className="tech-stack-picker" disabled={disabled}><legend>기술 스택</legend><p>목록에서 최대 20개를 선택하고, 선택한 기술의 손잡이를 끌어 표시 순서를 바꾸세요.</p>
    <div className="tech-stack-selection-title"><strong>선택한 기술</strong><span>{value.length} / 20</span></div>
    {value.length ? <ol className="tech-stack-selected" aria-label="선택한 기술 표시 순서">{value.map((name,index)=><li key={name} data-stack-name={name} data-dragging={dragging===name} data-drop-target={over===name&&dragging!==name}>
      <button type="button" className="tech-stack-grip" aria-label={`${name} 순서 변경`} title="끌어서 순서 변경 · 방향키로 이동" disabled={disabled}
        onPointerDown={event=>{if(event.button!==0||disabled)return;event.currentTarget.setPointerCapture(event.pointerId);source.current=name;setDragging(name);setOver(name);}}
        onPointerMove={event=>{if(source.current)setOver(targetAt(event));}}
        onPointerUp={event=>{const from=source.current,to=targetAt(event);source.current=null;setDragging(null);setOver(null);if(!disabled&&from&&to&&value.includes(to))move(from,to);}}
        onPointerCancel={()=>{source.current=null;setDragging(null);setOver(null);}}
        onKeyDown={event=>{const delta=event.key==="ArrowUp"||event.key==="ArrowLeft"?-1:event.key==="ArrowDown"||event.key==="ArrowRight"?1:0;if(delta){event.preventDefault();const target=value[index+delta];if(target)move(name,target);}}}>⠿</button>
      <span className="tech-stack-position" aria-hidden="true">{index+1}</span><span className="tech-stack-name">{name}</span>
      <div className="tech-stack-item-actions"><button type="button" aria-label={`${name} 위로`} disabled={disabled||index===0} onClick={()=>move(name,value[index-1])}>↑</button><button type="button" aria-label={`${name} 아래로`} disabled={disabled||index===value.length-1} onClick={()=>move(name,value[index+1])}>↓</button><button type="button" aria-label={`${name} 선택 해제`} disabled={disabled} onClick={()=>toggle(name)}>×</button></div>
    </li>)}</ol>:<p className="tech-stack-empty">아래 목록에서 기술을 선택해 주세요.</p>}
    <p className="sr-only" role="status">{notice}</p>
    <label className="tech-stack-search">기술 검색<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="기술 이름으로 검색"/></label>
    <div className="tech-stack-catalog">{groups.length ? groups.map(group=><div key={group.label}><h3>{group.label}</h3><div>{group.names.map(name=><label key={name} data-selected={selected.has(techStackKey(name))}><input type="checkbox" checked={selected.has(techStackKey(name))} disabled={disabled||!selected.has(techStackKey(name))&&value.length>=20} onChange={()=>toggle(name)}/><span>{name}</span></label>)}</div></div>):<p>검색한 기술이 없어요.</p>}</div>
  </fieldset>;
}

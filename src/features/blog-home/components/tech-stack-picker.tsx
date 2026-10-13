"use client";
import { useState } from "react";
import {useRegionDrag} from "./use-region-drag";
import { TECH_STACK_GROUPS, reorderTechStacks, techStackKey } from "../tech-stack-catalog";
export function TechStackPicker({value, disabled, onChange}: {value: string[]; disabled: boolean; onChange: (next: string[]) => void}) {
  const [query,setQuery]=useState("");
  const [notice,setNotice]=useState("");
  const drag=useRegionDrag("data-stack-name",disabled,move);
  const selected=new Set(value.map(techStackKey));
  function move(name: string,target: string) { onChange(reorderTechStacks(value,name,target)); setNotice(`${name} 위치를 변경했어요.`); }
  function toggle(name: string) { if(disabled)return; const key=techStackKey(name); if(selected.has(key))onChange(value.filter(item=>techStackKey(item)!==key)); else if(value.length<20)onChange([...value,name]); }
  const groups=TECH_STACK_GROUPS.map(group=>({...group,names:group.names.filter(name=>techStackKey(name).includes(techStackKey(query)))})).filter(group=>group.names.length);
  return <fieldset className="tech-stack-picker" disabled={disabled}><legend>기술 스택</legend><p>목록에서 최대 20개를 선택하고, 선택한 기술 영역을 끌어 표시 순서를 바꾸세요.</p>
    <div className="tech-stack-selection-title"><strong>선택한 기술</strong><span>{value.length} / 20</span></div>
    {value.length ? <ol className="tech-stack-selected" aria-label="선택한 기술 표시 순서">{value.map((name,index)=><li key={name} data-stack-name={name} {...drag.props(name)}>
      <span className="tech-stack-position" aria-hidden="true">{index+1}</span><span className="tech-stack-name">{name}</span>
      <div className="tech-stack-item-actions"><button type="button" aria-label={`${name} 선택 해제`} disabled={disabled} onClick={()=>toggle(name)}>×</button></div>
    </li>)}</ol>:<p className="tech-stack-empty">아래 목록에서 기술을 선택해 주세요.</p>}
    <p className="sr-only" role="status">{notice}</p>
    <label className="tech-stack-search">기술 검색<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="기술 이름으로 검색"/></label>
    <div className="tech-stack-catalog">{groups.length ? groups.map(group=><div key={group.label}><h3>{group.label}</h3><div>{group.names.map(name=><label key={name} data-selected={selected.has(techStackKey(name))}><input type="checkbox" checked={selected.has(techStackKey(name))} disabled={disabled||!selected.has(techStackKey(name))&&value.length>=20} onChange={()=>toggle(name)}/><span>{name}</span></label>)}</div></div>):<p>검색한 기술이 없어요.</p>}</div>
  </fieldset>;
}

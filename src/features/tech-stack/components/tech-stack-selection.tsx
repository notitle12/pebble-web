"use client";
import {useEffect,useState} from "react";
import {getPublicTechStacks,type PublicTechStack} from "../api/public-tech-stacks";
export function TechStackSelection({selected,existing=[],onChange,disabled=false}:{selected:string[];existing:PublicTechStack[];onChange:(ids:string[])=>void;disabled?:boolean}){
 const [items,setItems]=useState<PublicTechStack[]>(existing),[error,setError]=useState(false),[loading,setLoading]=useState(true),[query,setQuery]=useState("");
 useEffect(()=>{let live=true;getPublicTechStacks().then(values=>{if(live){setItems([...new Map([...existing,...values].map(item=>[item.id,item])).values()]);setLoading(false);}}).catch(()=>{if(live){setError(true);setLoading(false);}});return()=>{live=false;};},[]);
 return <div className="post-classification-field"><label>기술 스택</label><input aria-label="기술 스택 검색" placeholder="사용한 기술을 찾아 선택하세요" value={query} onChange={event=>setQuery(event.target.value)}/>{loading&&<p role="status">기술 스택을 불러오는 중…</p>}{error&&<p role="alert">기술 스택 목록을 불러오지 못했습니다. 기존 선택은 유지됩니다.</p>}<div className="post-classification-chips">{items.filter(item=>item.name.toLowerCase().includes(query.toLowerCase())).map(item=><label className="post-classification-chip" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={disabled||item.status!=="ACTIVE"&&!selected.includes(item.id)} onChange={event=>onChange(event.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>{item.name}{item.status!=="ACTIVE"?" · 기존 기술":""}</label>)}</div></div>;
}

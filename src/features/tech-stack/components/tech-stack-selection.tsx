"use client";
import {useEffect,useMemo,useState} from "react";
import {getPublicTechStacks,type PublicTechStack} from "../api/public-tech-stacks";
import {filterTechStacks,mergeTechStacks,TECH_FILTERS,type TechFilter} from "../tech-stack-groups";
import {techStackLogo} from "../../blog-home/tech-stack-logos";
import styles from "./tech-stack-selection.module.css";

function TechLogo({name}:{name:string}) {
  const logo=techStackLogo(name);
  return logo ? <img className={styles.logo} src={logo} alt="" width={20} height={20}/> : <span className={styles.fallback} aria-hidden="true">{name.slice(0,1).toUpperCase()}</span>;
}
export function TechStackSelection({selected,existing=[],onChange,disabled=false}:{selected:string[];existing:PublicTechStack[];onChange:(ids:string[])=>void;disabled?:boolean}) {
  const [fetched,setFetched]=useState<PublicTechStack[]>([]);
  const [error,setError]=useState(false),[loading,setLoading]=useState(true);
  const [query,setQuery]=useState(""),[group,setGroup]=useState<TechFilter>("all"),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let live=true;
    setLoading(true);setError(false);
    getPublicTechStacks().then(values=>{if(live){setFetched(values);setLoading(false);}}).catch(()=>{if(live){setError(true);setLoading(false);}});
    return()=>{live=false;};
  },[attempt]);
  // Existing props can arrive after mount when an edit document finishes loading.
  const items=useMemo(()=>mergeTechStacks(existing,fetched),[existing,fetched]);
  const savedIds=new Set(existing.map(item=>item.id));
  const byId=new Map(items.map(item=>[item.id,item]));
  const results=filterTechStacks(items.filter(item=>item.status==="ACTIVE"||savedIds.has(item.id)),group,query);
  const remove=(id:string)=>onChange(selected.filter(value=>value!==id));
  return <section className={styles.picker} aria-label="기술 스택 선택">
    <div className={styles.selectedHeading}><strong>선택한 기술</strong><span>{selected.length}개</span></div>
    <div className={styles.selected} aria-label="선택한 기술 스택">
      {selected.length===0 ? <p className={styles.hint}>사용한 기술을 검색하거나 분류에서 선택하세요.</p> : selected.map(id=>{
        const item=byId.get(id),name=item?.name??`기존 기술 (${id})`;
        return <button type="button" className={styles.chip} key={id} disabled={disabled} aria-label={`${name} 제거`} onClick={()=>remove(id)}>
          <TechLogo name={name}/><span>{name}</span><span aria-hidden="true">×</span>
        </button>;
      })}
    </div>
    <input className={styles.search} aria-label="기술 스택 검색" type="search" placeholder="기술 이름 검색" value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)}/>
    <div className={styles.filters} role="group" aria-label="기술 분류">
      {TECH_FILTERS.map(filter=><button type="button" key={filter.id} aria-pressed={group===filter.id} disabled={disabled} onClick={()=>setGroup(filter.id)}>{filter.label}</button>)}
    </div>
    {loading&&<p className={styles.hint} role="status">기술 목록을 불러오는 중…</p>}
    {error&&<div className={styles.error} role="alert"><span>기술 목록을 불러오지 못했어요. 기존 선택은 유지됩니다.</span><button type="button" disabled={disabled} onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></div>}
    <div className={styles.results} aria-label="기술 검색 결과" tabIndex={0}>
      {results.map(item=>{
        const checked=selected.includes(item.id);
        return <button type="button" key={item.id} aria-pressed={checked} disabled={disabled} onClick={()=>checked?remove(item.id):onChange([...selected,item.id])}>
          <TechLogo name={item.name}/><span className={styles.name}>{item.name}{item.status!=="ACTIVE"&&<small>기존 기술</small>}</span><span className={styles.mark} aria-hidden="true">{checked?"✓":"+"}</span>
        </button>;
      })}
      {!loading&&results.length===0&&<p className={styles.hint}>조건에 맞는 등록 기술이 없어요.</p>}
    </div>
  </section>;
}

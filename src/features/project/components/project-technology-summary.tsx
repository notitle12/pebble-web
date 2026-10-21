'use client';
import {useEffect,useState} from 'react';
import {getPublicTechStacks,type PublicTechStack} from '@/features/tech-stack/api/public-tech-stacks';
import {TECH_FILTERS,techStackGroups} from '@/features/tech-stack/tech-stack-groups';
import styles from './project-technology-summary.module.css';
export function ProjectTechnologySummary({selected,existing=[]}:{selected:string[];existing?:Pick<PublicTechStack,"id"|"name">[]}){
 const [catalog,setCatalog]=useState<PublicTechStack[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const selectedKey=selected.join(','),existingKey=JSON.stringify(existing);
 useEffect(()=>{let live=true;const known=new Set([...existing,...catalog].map(item=>item.id));if(selected.every(id=>known.has(id))){setLoading(false);setError(false);return;}setLoading(true);setError(false);getPublicTechStacks().then(items=>{if(live)setCatalog(items);}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[selectedKey,existingKey,attempt]);
 const byId=new Map([...existing,...catalog].map(item=>[item.id,item]));
 const items=selected.map(id=>byId.get(id)).filter((item):item is Pick<PublicTechStack,"id"|"name">=>!!item);
 const groups=TECH_FILTERS.filter(group=>group.id!=='all').map(group=>({...group,items:items.filter(item=>techStackGroups(item.name)[0]===group.id)})).filter(group=>group.items.length>0);
 return <div className={styles.groups}>{groups.map(group=><div className={styles.group} key={group.id}><h3>{group.label}</h3><ul>{group.items.map(item=><li key={item.id}><span>{item.name}</span></li>)}</ul></div>)}{loading&&<p role="status">기술 스택을 불러오고 있어요.</p>}{!loading&&(error||items.length<selected.length)&&<p role="alert">일부 기술 정보를 불러오지 못했어요. <button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 불러오기</button></p>}</div>;
}

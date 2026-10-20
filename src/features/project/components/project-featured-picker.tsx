'use client';
import type {BlogHomeSettings} from '@/features/blog-home/api/blog-home';
import type {FeaturedSelection} from '../project-featured-selection';
import styles from './project-featured-picker.module.css';

type Props={home:BlogHomeSettings|null;selection:FeaturedSelection;projectId?:string;names:Record<string,string>;loading:boolean;error:string;disabled:boolean;publicProject:boolean;onChange:(selection:FeaturedSelection)=>void;onReload:()=>void};
export function ProjectFeaturedPicker({home,selection,projectId,names,loading,error,disabled,publicProject,onChange,onReload}:Props){
 const others=home?.featuredProjectIds.filter(id=>id!==projectId)??[];
 const count=others.filter(id=>!selection.removedIds.includes(id)).length+(selection.featured&&publicProject?1:0);
 return <section className={styles.picker} aria-label="대표 프로젝트 설정"><h3>대표 프로젝트</h3>
 {loading?<p role="status">대표 프로젝트를 불러오는 중…</p>:error?<div><p role="alert">{error}</p><button type="button" disabled={disabled} onClick={onReload}>다시 불러오기</button></div>:home&&<>
 <label className={styles.choice}><input type="checkbox" checked={selection.featured&&publicProject} disabled={disabled||!publicProject} onChange={event=>onChange({...selection,featured:event.target.checked})}/>이 프로젝트를 블로그 홈의 대표 프로젝트로 설정</label>
 <p>{publicProject?`홈 표시 개수 ${home.featuredProjectLimit}개 · 현재 선택 ${count}개`:'공개 프로젝트만 대표 프로젝트로 설정할 수 있어요.'}</p>
 {others.length>0&&<div className={styles.existing}><p>기존 대표 프로젝트</p>{others.map(id=><label className={styles.choice} key={id}><input type="checkbox" disabled={disabled} checked={!selection.removedIds.includes(id)} onChange={event=>onChange({...selection,removedIds:event.target.checked?selection.removedIds.filter(item=>item!==id):[...selection.removedIds,id]})}/><span>{names[id]??'프로젝트 이름을 불러오지 못했어요'}</span></label>)}</div>}
 {selection.featured&&publicProject&&count>home.featuredProjectLimit&&<p role="alert">기존 대표 프로젝트를 하나 이상 해제해 표시 개수에 맞춰 주세요.</p>}
 </>}
 </section>;
}

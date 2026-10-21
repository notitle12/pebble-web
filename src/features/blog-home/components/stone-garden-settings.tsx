"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {MemberGate} from '../../auth/components/member-gate';
import {userSession,type Member} from '../../auth/user-session';
import {getMyGarden} from '../api/stone-garden';
import {type Garden} from '../stone-garden';
import {StoneGarden} from './stone-garden';
function Settings({member}:{member:Member}){
 const [garden,setGarden]=useState<Garden|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[preview,setPreview]=useState<number|null>(null);
 useEffect(()=>{let live=true;setError(false);setGarden(null);getMyGarden(path=>userSession.request(path)).then(value=>{if(live)setGarden(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[member.id,attempt]);
 const count=preview??garden?.publicationCount??0;
 return <section className="garden-settings"><header><div><p className="profile-eyebrow">{member.blogName??'Pebble'}</p><h1>기록의 돌</h1><p>글을 쓸수록, 나만의 작은 풍경이 자라요.</p></div><Link href="/settings/blog/home">홈 구성</Link></header>
 {error?<p role="alert">기록을 불러오지 못했어요. <button onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></p>:!garden?<p role="status">기록을 불러오고 있어요.</p>:<><div className="garden-count"><strong>{count.toLocaleString()}</strong><span>{preview===null?'지금까지 발행한 글':'미리보기 발행 수'}</span></div><StoneGarden publicationCount={count}/><p className="garden-explanation">기록이 늘수록 새로운 돌이 쌓이고, 풀과 대나무는 조금씩 자라요. 월이 바뀌어도 기록은 그대로예요.</p>
 {process.env.NODE_ENV==='development'&&<section className="garden-growth-preview" aria-labelledby="garden-preview-title"><h2 id="garden-preview-title">성장 미리보기</h2><p>테스트용 미리보기예요. 실제 발행 수나 블로그에는 저장되지 않아요.</p><div className="garden-preview-presets">{[0,1,5,10,25,50,100,250,500,1000,2500,5000].map(value=><button type="button" key={value} aria-pressed={preview===value} onClick={()=>setPreview(value)}>{value.toLocaleString()}</button>)}<button type="button" onClick={()=>setPreview(null)} aria-pressed={preview===null}>내 기록</button></div><label>발행 수 <input type="range" min="0" max="5000" value={count} onChange={event=>setPreview(Number(event.target.value))}/><input type="number" aria-label="미리보기 발행 수" min="0" max="5000" value={count} onChange={event=>{const value=Number(event.target.value);if(Number.isInteger(value)&&value>=0&&value<=5000)setPreview(value);}}/></label><div className="garden-growth-comparison">{[1,10,50,100].map(value=><figure key={value}><figcaption>글 {value}개</figcaption><StoneGarden publicationCount={value}/></figure>)}</div></section>}</>}
 </section>;
}
export function StoneGardenSettings(){return <MemberGate profile>{member=><Settings key={member.id} member={member}/>}</MemberGate>;}

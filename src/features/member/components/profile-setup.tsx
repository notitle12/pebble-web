"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import Link from "next/link";
import {MemberGate,useUserSession} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberApiError,responseData} from "@/lib/member-api";
import {BlogLinksEditor} from "@/features/blog-tools/components/blog-links-editor";
import {formatProfileAvailability,normalizeHandle,normalizeProfileName,parseEditableMemberProfile,safeProfileReturnTo,type EditableMemberProfile} from "../profile-model";

type EditorState=EditableMemberProfile&{nicknameDraft:string;blogNameDraft:string};
type Field="blogName"|"nickname"|"handle";
type Check={value:string;available:boolean}|null;
const MAX_IMAGE=10*1024*1024;
const IMAGE_TYPES=["image/png","image/jpeg","image/webp"];
function editorState(profile:EditableMemberProfile):EditorState{return {...profile,nicknameDraft:profile.nickname,blogNameDraft:profile.blogName};}
function imageError(file:File){if(!IMAGE_TYPES.includes(file.type))return "PNG, JPEG, WebP 이미지만 선택할 수 있어요.";if(file.size>MAX_IMAGE)return "이미지는 10MiB 이하로 선택해 주세요.";return "";}
function avatarUrl(value:string|null){if(!value)return "";try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}}

function Setup({member}:{member:Member}){
 const router=useRouter(),params=useSearchParams(),session=useUserSession();
 const completed=member.profileCompleted;
 const [blogName,setBlog]=useState(member.blogName??"");
 const [handle,setHandle]=useState("");
 const [nickname,setNickname]=useState(member.nickname);
 const [editor,setEditor]=useState<EditorState|null>(null);
 const [checks,setChecks]=useState<Record<Field,Check>>({blogName:null,nickname:null,handle:null});
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState("");
 const [removeImage,setRemoveImage]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const [nicknameSuggesting,setNicknameSuggesting]=useState(false),[suggestionExhausted,setSuggestionExhausted]=useState(false);
 const busyRef=useRef(false),mounted=useRef(false),fileInput=useRef<HTMLInputElement>(null),objectUrl=useRef("");
 const savedReturnTo=safeProfileReturnTo(params.get("returnTo"));
 const visibleImage=preview||(!removeImage?avatarUrl(completed?editor?.profileImageUrl??member.profileImageUrl:member.profileImageUrl):"");
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);};},[]);
 function sameReadyMember(id:string){const current=userSession.snapshot();return mounted.current&&current.phase==="ready"&&current.member?.id===id;}
 function setDraftFile(next:File|null){if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current="";}setFile(next);setPreview("");setError("");if(next){const issue=imageError(next);if(issue){setFile(null);setError(issue);if(fileInput.current)fileInput.current.value="";return;}objectUrl.current=URL.createObjectURL(next);setPreview(objectUrl.current);setRemoveImage(false);}}
 async function availability(field:Field,value:string){
   const normalized=field==="handle"?normalizeHandle(value):normalizeProfileName(value,field);
   const query=new URLSearchParams({field,value:normalized});
   const data=responseData(await userSession.request(`/members/me/profile/availability?${query.toString()}`));
   if(typeof data.available!=="boolean"||typeof data.value!=="string")throw new MemberApiError(0,"INVALID_RESPONSE","중복 확인 응답을 확인하지 못했습니다.");
   return {value:data.value,available:data.available};
 }
 async function suggestNickname(base:string,isCancelled:()=>boolean=()=>false){
   for(let i=0;i<5;i++){const suffix=String(Math.floor(1000+Math.random()*9000));const prefix=Array.from(base).slice(0,30-Array.from(suffix).length).join("");const candidate=`${prefix}${suffix}`;const result=await availability("nickname",candidate);if(isCancelled())return null;if(result.available)return result;}
   return null;
 }
 async function checkField(field:Field,value:string){const id=member.id;if(!sameReadyMember(id))return;setError("");setChecks(old=>({...old,[field]:null}));try{const result=await availability(field,value);if(!sameReadyMember(id))return;setChecks(old=>({...old,[field]:result}));}catch(e){if(sameReadyMember(id))setError(e instanceof Error?e.message:"중복을 확인하지 못했습니다.");}}
 async function loadProfile(id:string){if(!sameReadyMember(id))return;try{const profile=parseEditableMemberProfile(await userSession.request("/members/me"),id);if(sameReadyMember(id))setEditor(editorState(profile));}catch(e){if(sameReadyMember(id))setError(e instanceof Error?e.message:"프로필을 불러오지 못했습니다.");}}
 useEffect(()=>{
   setEditor(null);setError("");setNotice("");setUncertain(false);
   if(completed){if(session.phase==="ready"&&session.member?.id===member.id)void loadProfile(member.id);return;}
   let cancelled=false;
   async function seedNickname(){setNicknameSuggesting(true);try{const candidate=normalizeProfileName(member.nickname,"nickname");const current=await availability("nickname",candidate);if(cancelled)return;if(current.available){setNickname(current.value);setChecks(old=>({...old,nickname:current}));return;}const suggested=await suggestNickname(candidate,()=>cancelled);if(cancelled)return;if(suggested){setNickname(suggested.value);setChecks(old=>({...old,nickname:suggested}));setNotice("기본 닉네임이 사용 중이라 사용할 수 있는 숫자 조합을 제안했어요. 원하는 값으로 바꿀 수 있습니다.");return;}setSuggestionExhausted(true);setNotice("기본 닉네임의 중복을 자동으로 정리하지 못했어요. 다시 시도하거나 닉네임을 직접 입력해 주세요.");}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"기본 닉네임 중복을 확인하지 못했습니다.");}finally{if(!cancelled)setNicknameSuggesting(false);}}
   if(session.phase==="ready"&&session.member?.id===member.id)void seedNickname();
   return()=>{cancelled=true;};
 // Availability checks only run for the current account and initial nickname.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[member.id,completed]);
 async function refreshAfterUnknown(id:string){if(busyRef.current||!sameReadyMember(id))return;busyRef.current=true;setBusy(true);try{await userSession.reloadMember();if(!sameReadyMember(id))return;const current=userSession.snapshot().member;if(!current?.profileCompleted){setEditor(null);setDraftFile(null);setRemoveImage(false);setUncertain(false);setError("");setNotice("프로필 설정이 완료되지 않은 것을 확인했습니다. 입력을 확인한 뒤 다시 시도할 수 있어요.");return;}const latest=parseEditableMemberProfile(await userSession.request("/members/me"),id);if(!sameReadyMember(id))return;setEditor(editorState(latest));setDraftFile(null);setRemoveImage(false);setUncertain(false);setError("");setNotice("서버 상태를 다시 불러왔습니다. 저장 여부를 확인해 주세요.");}catch(e){if(sameReadyMember(id))setError(e instanceof Error?e.message:"서버 상태를 다시 불러오지 못했습니다.");}finally{busyRef.current=false;if(mounted.current)setBusy(false);}}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const id=member.id;if(busyRef.current||uncertain||!sameReadyMember(id))return;let writeAttempted=false,writeConfirmed=false;busyRef.current=true;setBusy(true);setError("");setNotice("");try{
   let body:Record<string,unknown>;
   if(completed){if(!editor||editor.id!==id)throw new Error("프로필을 먼저 다시 불러와 주세요.");const nextBlog=normalizeProfileName(editor.blogNameDraft,"blogName"),nextNickname=normalizeProfileName(editor.nicknameDraft,"nickname");const blogChanged=nextBlog!==editor.blogName,nicknameChanged=nextNickname!==editor.nickname;const imageChanged=Boolean(file)||removeImage;if(!blogChanged&&!nicknameChanged&&!imageChanged){setNotice("변경된 내용이 없습니다.");return;}const now=Date.now();if(blogChanged&&editor.blogNameChangeAvailableAt&&Date.parse(editor.blogNameChangeAvailableAt)>now)throw new Error(formatProfileAvailability(editor.blogNameChangeAvailableAt,now));if(nicknameChanged&&editor.nicknameChangeAvailableAt&&Date.parse(editor.nicknameChangeAvailableAt)>now)throw new Error(formatProfileAvailability(editor.nicknameChangeAvailableAt,now));body={};if(blogChanged)body.blogName=nextBlog;if(nicknameChanged)body.nickname=nextNickname;if(removeImage)body.removeProfileImage=true;
   }else{body={blogName:normalizeProfileName(blogName,"blogName"),handle:normalizeHandle(handle),nickname:normalizeProfileName(nickname,"nickname")};if(removeImage)body.removeProfileImage=true;}
   let requestBody:unknown=body;if(file){const form=new FormData();form.append("profile",JSON.stringify(body));form.append("file",file);requestBody=form;}
   writeAttempted=true;const result=await userSession.request("/members/me/profile",{method:completed?"PATCH":"POST",body:requestBody});writeConfirmed=true;
   if(!sameReadyMember(id))return;
   if(!completed){const data=responseData(result);if(typeof data.handle!=="string")throw new MemberApiError(0,"INVALID_RESPONSE","저장 결과에서 블로그 아이디를 확인하지 못했습니다.");setNotice("프로필을 저장했습니다. 내 블로그로 이동합니다.");await userSession.reloadMember();if(sameReadyMember(id))router.replace(`/blogs/${encodeURIComponent(data.handle)}`);return;}
   await userSession.reloadMember();if(!sameReadyMember(id))return;const latest=parseEditableMemberProfile(await userSession.request("/members/me"),id);if(!sameReadyMember(id))return;setEditor(editorState(latest));setDraftFile(null);setRemoveImage(false);setUncertain(false);setNotice("변경 사항을 저장했습니다.");
  }catch(e){if(!sameReadyMember(id))return;const knownRejection=e instanceof MemberApiError&&e.status>=400&&e.status<500;if(writeAttempted&&(!knownRejection||writeConfirmed)){setUncertain(true);setError("저장 결과를 확인할 수 없습니다. 다시 저장하지 말고 서버 상태를 불러와 확인해 주세요.");}else setError(e instanceof Error?e.message:"프로필을 저장하지 못했습니다.");}finally{busyRef.current=false;if(mounted.current)setBusy(false);}}
 function cancelEdit(){setDraftFile(null);setRemoveImage(false);router.push(savedReturnTo??(member.handle?`/blogs/${encodeURIComponent(member.handle)}`:"/me/blog"));}
 const active=busy||session.phase!=="ready"||session.member?.id!==member.id||nicknameSuggesting;
 if(completed&&(!editor||editor.id!==member.id))return <section className="list-state" aria-live="polite"><h2>프로필을 불러오고 있어요</h2>{error&&<p role="alert">{error}</p>}{error&&<button className="button" type="button" onClick={()=>{setError("");void loadProfile(member.id);}}>다시 불러오기</button>}</section>;
 return <section className="profile-screen">
  <header className="profile-heading"><div><p className="profile-eyebrow">Pebble 계정</p><h1>{completed?"프로필":"블로그 생성"}</h1></div>{completed&&<Link className="profile-account-link" href="/settings/account">설정</Link>}</header>
  <form className="search-panel profile-form" onSubmit={submit}>
   <fieldset disabled={active||uncertain}><legend>{completed?"프로필 정보":"블로그 기본 정보"}</legend>
    <section className="profile-photo-field" aria-label="프로필 사진"><div className="profile-avatar-frame">{visibleImage?<img src={visibleImage} alt="프로필 미리보기"/>:<span aria-hidden="true">{(completed?editor?.nicknameDraft??"":nickname).slice(0,1)||"Pebble"}</span>}</div><div className="profile-photo-actions"><label className="button profile-file-button" htmlFor="profile-image">이미지 불러오기</label><input ref={fileInput} className="sr-only" id="profile-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setDraftFile(e.target.files?.[0]??null)}/><button className="button" type="button" onClick={()=>{setDraftFile(null);if(fileInput.current)fileInput.current.value="";setRemoveImage(true);}}>초기화</button><p>PNG, JPEG, WebP · 10MiB 이하. 저장을 눌렀을 때 업로드합니다.</p></div></section>
    <div className="profile-input-row"><div className="search-field"><label htmlFor="profile-blog">블로그명</label><input id="profile-blog" required maxLength={200} value={completed?editor?.blogNameDraft??"":blogName} onChange={e=>{if(completed)setEditor(s=>s?{...s,blogNameDraft:e.target.value}:s);else setBlog(e.target.value);setChecks(s=>({...s,blogName:null}));}}/></div><button className="button profile-check" type="button" onClick={()=>void checkField("blogName",completed?editor?.blogNameDraft??"":blogName)}>중복 확인</button></div>
    {checks.blogName?.value===(completed?editor?.blogNameDraft??"":blogName).trim().normalize("NFC")&&<p className="profile-availability" role="status">{checks.blogName.available?"사용할 수 있어요.":"이미 사용 중이에요."}</p>}<p className="profile-help">한글·영문·숫자·공백·일반 문장부호를 사용할 수 있어요. 제어 문자는 사용할 수 없고 100자 이내로 입력해 주세요. {completed&&editor&&formatProfileAvailability(editor.blogNameChangeAvailableAt)}</p>
    {completed?<><div className="profile-input-row"><div className="search-field"><label htmlFor="profile-nickname">닉네임</label><input id="profile-nickname" required maxLength={60} value={editor?.nicknameDraft??""} onChange={e=>{setEditor(s=>s?{...s,nicknameDraft:e.target.value}:s);setChecks(s=>({...s,nickname:null}));}}/></div><button className="button profile-check" type="button" onClick={()=>void checkField("nickname",editor?.nicknameDraft??"")}>중복 확인</button></div>{checks.nickname?.value===(editor?.nicknameDraft??"").trim().normalize("NFC")&&<p className="profile-availability" role="status">{checks.nickname.available?"사용할 수 있어요.":"이미 사용 중이에요."}</p>}<p className="profile-help">한글·영문·숫자·공백·일반 문장부호를 사용할 수 있어요. 제어 문자는 사용할 수 없고 30자 이내로 입력해 주세요. {editor&&formatProfileAvailability(editor.nicknameChangeAvailableAt)}</p><div className="search-field"><label htmlFor="profile-handle">식별자 아이디(변경 불가)</label><input id="profile-handle" readOnly value={editor?.handle??""}/></div></>:<><div className="profile-input-row"><div className="search-field"><label htmlFor="profile-nickname">닉네임</label><input id="profile-nickname" required maxLength={60} value={nickname} onChange={e=>{setNickname(e.target.value);setChecks(s=>({...s,nickname:null}));setSuggestionExhausted(false);}}/></div><button className="button profile-check" type="button" onClick={()=>void checkField("nickname",nickname)}>중복 확인</button></div>{checks.nickname?.value===nickname.trim().normalize("NFC")&&<p className="profile-availability" role="status">{checks.nickname.available?"사용할 수 있어요.":"이미 사용 중이에요."}</p>}<p className="profile-help">한글·영문·숫자·공백·일반 문장부호를 사용할 수 있어요. 제어 문자는 사용할 수 없고 30자 이내로 입력해 주세요.</p>{suggestionExhausted&&<button className="button" type="button" disabled={nicknameSuggesting} onClick={async()=>{setNicknameSuggesting(true);setSuggestionExhausted(false);setError("");try{const candidate=normalizeProfileName(member.nickname,"nickname");const suggested=await suggestNickname(candidate);if(suggested){setNickname(suggested.value);setChecks(old=>({...old,nickname:suggested}));setNotice("사용할 수 있는 닉네임을 제안했어요.");}else setSuggestionExhausted(true);}catch(e){setError(e instanceof Error?e.message:"닉네임을 다시 확인하지 못했습니다.");}finally{setNicknameSuggesting(false);}}}>숫자 조합 다시 제안</button>}<div className="profile-input-row"><div className="search-field"><label htmlFor="profile-handle">식별자 아이디(변경 불가)</label><input id="profile-handle" required minLength={3} maxLength={30} pattern={"[a-z][a-z0-9_\\-]{1,28}[a-z0-9_]"} value={handle} onChange={e=>{setHandle(e.target.value.toLowerCase());setChecks(s=>({...s,handle:null}));}}/></div><button className="button profile-check" type="button" onClick={()=>void checkField("handle",handle)}>중복 확인</button></div>{checks.handle?.value===handle&&<p className="profile-availability" role="status">{checks.handle.available?"사용할 수 있어요.":"이미 사용 중이에요."}</p>}<p className="profile-help">영문 소문자로 시작하는 3~30자 영문·숫자·하이픈·밑줄을 사용하세요. 하이픈으로 끝날 수 없고, 설정 후에는 변경할 수 없어요.</p></>}
    {error&&<p className="profile-error" role="alert">{error}</p>}{notice&&<p className="profile-notice" role="status">{notice}</p>}
   </fieldset>
   <div className="profile-actions">{uncertain?<button className="button" type="button" disabled={busy} onClick={()=>void refreshAfterUnknown(member.id)}>서버 상태 다시 불러오기</button>:<button className="button profile-primary" type="submit" disabled={active}>{busy?"저장 중…":completed?"변경 사항 저장":"저장"}</button>}{completed&&<button className="button" type="button" disabled={active||uncertain} onClick={cancelEdit}>취소</button>}</div>
  </form>
  {completed&&<BlogLinksEditor member={member}/>}
 </section>;
}
export function ProfileSetup(){return <MemberGate preserveOnExpiry>{member=><Setup key={member.id} member={member}/>}</MemberGate>;}

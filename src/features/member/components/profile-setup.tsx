"use client";
import {useEffect,useRef,useState} from "react";
import {MemberGate,useUserSession} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {MemberApiError} from "@/lib/member-api";
import {formatProfileAvailability,normalizeProfileName,parseEditableMemberProfile,type EditableMemberProfile} from "../profile-model";

type EditorState = EditableMemberProfile & {nicknameDraft:string;blogNameDraft:string};
function editorState(profile:EditableMemberProfile):EditorState{return {...profile,nicknameDraft:profile.nickname,blogNameDraft:profile.blogName};}

function Setup({member}:{member:Member}){
  const session=useUserSession();
  const [blogName,setBlog]=useState("");
  const [handle,setHandle]=useState("");
  const [editor,setEditor]=useState<EditorState|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const busyRef=useRef(false);
  const mounted=useRef(false);

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  function sameReadyMember(id:string){const current=userSession.snapshot();return mounted.current&&current.phase==="ready"&&current.member?.id===id;}

  async function loadProfile(id:string){
    if(!sameReadyMember(id))return;
    try{
      const profile=parseEditableMemberProfile(await userSession.request("/members/me"),id);
      if(sameReadyMember(id))setEditor(editorState(profile));
    }catch(e){if(sameReadyMember(id))setError(e instanceof Error?e.message:"프로필을 불러오지 못했습니다.");}
  }

  useEffect(()=>{
    setEditor(null);setError("");setNotice("");setUncertain(false);
    if(member.profileCompleted&&session.phase==="ready"&&session.member?.id===member.id)void loadProfile(member.id);
  // loadProfile is intentionally scoped to the account/session identity; the effect runs on account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[member.id,member.profileCompleted]);

  async function refreshAfterUnknown(id:string){
    if(!sameReadyMember(id))return;
    try{
      await userSession.reloadMember();
      if(!sameReadyMember(id))return;
      if(!userSession.snapshot().member?.profileCompleted){
        setEditor(null);setUncertain(false);setError("");setNotice("프로필 설정이 완료되지 않은 것을 확인했습니다. 입력을 확인한 뒤 다시 시도할 수 있어요.");return;
      }
      const latest=parseEditableMemberProfile(await userSession.request("/members/me"),id);
      if(!sameReadyMember(id))return;
      setEditor(editorState(latest));setUncertain(false);setError("");setNotice("서버 상태를 다시 불러왔습니다. 저장 여부를 확인해 주세요.");
    }catch(e){if(sameReadyMember(id))setError(e instanceof Error?e.message:"서버 상태를 다시 불러오지 못했습니다.");}
  }

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const id=member.id;
    if(busyRef.current||uncertain||!sameReadyMember(id))return;
    let writeAttempted=false;
    let writeConfirmed=false;
    busyRef.current=true;setBusy(true);setError("");setNotice("");
    try{
      if(member.profileCompleted){
        if(!editor||editor.id!==id)throw new Error("프로필을 먼저 다시 불러와 주세요.");
        const nextBlog=normalizeProfileName(editor.blogNameDraft,"blogName");
        const nextNickname=normalizeProfileName(editor.nicknameDraft,"nickname");
        const blogChanged=nextBlog!==editor.blogName;
        const nicknameChanged=nextNickname!==editor.nickname;
        if(!blogChanged&&!nicknameChanged){setNotice("변경된 내용이 없습니다.");return;}
        const now=Date.now();
        if(blogChanged&&editor.blogNameChangeAvailableAt&&Date.parse(editor.blogNameChangeAvailableAt)>now)throw new Error(formatProfileAvailability(editor.blogNameChangeAvailableAt,now));
        if(nicknameChanged&&editor.nicknameChangeAvailableAt&&Date.parse(editor.nicknameChangeAvailableAt)>now)throw new Error(formatProfileAvailability(editor.nicknameChangeAvailableAt,now));
        const body:{blogName?:string;nickname?:string}={};
        if(blogChanged)body.blogName=nextBlog;
        if(nicknameChanged)body.nickname=nextNickname;
        writeAttempted=true;
        await userSession.request("/members/me/profile",{method:"PATCH",body});
        writeConfirmed=true;
      }else{
        writeAttempted=true;
        await userSession.request("/members/me/profile",{method:"POST",body:{blogName,handle}});
        writeConfirmed=true;
      }
      if(!sameReadyMember(id))return;
      setNotice("프로필을 저장했습니다.");
      await userSession.reloadMember();
      if(!sameReadyMember(id))return;
      const latest=parseEditableMemberProfile(await userSession.request("/members/me"),id);
      if(!sameReadyMember(id))return;
      setEditor(editorState(latest));setUncertain(false);
    }catch(e){
      if(!sameReadyMember(id))return;
      const knownRejection=e instanceof MemberApiError&&e.status>=400&&e.status<500;
      if(writeAttempted&&(!knownRejection||writeConfirmed)){
        setUncertain(true);setError("저장 결과를 확인할 수 없습니다. 다시 저장하지 말고 서버 상태를 불러와 확인해 주세요.");
      }else setError(e instanceof Error?e.message:"프로필을 저장하지 못했습니다.");
    }finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  }

  if(member.profileCompleted){
    if(!editor||editor.id!==member.id)return <section className="list-state"><h2>프로필을 불러오고 있어요</h2>{error&&<><p role="alert">{error}</p><button className="button" onClick={()=>{setError("");void loadProfile(member.id);}}>다시 불러오기</button></>}</section>;
    return <form className="search-panel" onSubmit={submit}>
      <fieldset disabled={busy||session.phase!=="ready"||session.member?.id!==member.id}>
        <legend>내 블로그 프로필 수정</legend>
        <div className="search-field"><label htmlFor="profile-blog">블로그명</label><input id="profile-blog" required disabled={uncertain} maxLength={200} value={editor.blogNameDraft} onChange={e=>setEditor(current=>current?.id===member.id?{...current,blogNameDraft:e.target.value}:current)} /></div>
        <p>{formatProfileAvailability(editor.blogNameChangeAvailableAt)}</p>
        <div className="search-field"><label htmlFor="profile-nickname">닉네임</label><input id="profile-nickname" required disabled={uncertain} maxLength={60} value={editor.nicknameDraft} onChange={e=>setEditor(current=>current?.id===member.id?{...current,nicknameDraft:e.target.value}:current)} /></div>
        <p>{formatProfileAvailability(editor.nicknameChangeAvailableAt)}</p>
        <div className="search-field"><label htmlFor="profile-handle">공개 아이디</label><input id="profile-handle" readOnly value={editor.handle} /></div>
        <p>공개 아이디는 변경할 수 없습니다. 이름 변경은 각 필드별 7일 간격으로 가능하며, 서버에 저장된 변경 가능 시각을 기준으로 합니다.</p>
        {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
        {uncertain?<button className="button" type="button" onClick={()=>void refreshAfterUnknown(member.id)}>서버 상태 다시 불러오기</button>:<button className="button" type="submit">{busy?"저장 중…":"변경 저장"}</button>}
        <button className="button" type="button" disabled={busy} onClick={()=>void userSession.logout()}>로그아웃</button>
      </fieldset>
    </form>;
  }

  return <form className="search-panel" onSubmit={submit}><fieldset disabled={busy||session.phase!=="ready"||session.member?.id!==member.id}><legend>내 블로그 설정</legend><div className="search-field"><label htmlFor="setup-blog">블로그명</label><input id="setup-blog" required disabled={uncertain} maxLength={200} value={blogName} onChange={e=>setBlog(e.target.value)} /></div><div className="search-field"><label htmlFor="setup-handle">공개 아이디</label><input id="setup-handle" required disabled={uncertain} pattern="[a-z][a-z0-9-]{2,29}" value={handle} onChange={e=>setHandle(e.target.value)} /></div><p>영문 소문자로 시작하는 3~30자의 영문·숫자·하이픈을 사용하세요. 공개 아이디는 설정 후 변경할 수 없습니다.</p>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}{uncertain?<button className="button" type="button" onClick={()=>void refreshAfterUnknown(member.id)}>서버 상태 다시 불러오기</button>:<button className="button" type="submit">{busy?"설정 중…":"블로그 설정"}</button>}<button className="button" type="button" disabled={busy} onClick={()=>void userSession.logout()}>로그아웃</button></fieldset></form>;
}

export function ProfileSetup(){return <MemberGate preserveOnExpiry>{member=><Setup key={member.id} member={member}/>}</MemberGate>;}

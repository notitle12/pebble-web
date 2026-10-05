"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {userSession} from "../../auth/user-session";
import {confirmDeletion} from "../../content/management-model";
import {MemberApiError} from "../../../lib/member-api";
import {parseOwnedMedia} from "../owned-media";
import {parseThumbnailResponse,parseMediaResponse,mediaOrder,validMediaOrder,validMediaAlt,mediaFailure,mediaFileError,safeMediaUrl,type ProjectMedia,type MediaRole} from "../model";

type Props={kind:"posts"|"projects";id:string;memberId:string;disabled?:boolean};
type Values={altText:string;displayOrder:string};
export function ContentMedia({kind,id,memberId,disabled=false}:Props){
  const [thumbnail,setThumbnail]=useState<string|null>(null),[media,setMedia]=useState<ProjectMedia[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false),[attempt,setAttempt]=useState(0),[file,setFile]=useState<File|null>(null),[role,setRole]=useState<MediaRole>("SCREENSHOT"),[altText,setAltText]=useState(""),[displayOrder,setDisplayOrder]=useState("0"),[edits,setEdits]=useState<Record<string,Values>>({});
  const mounted=useRef(false),busyRef=useRef(false),sequence=useRef(0);
  const canUse=useCallback(()=>{const session=userSession.snapshot();return mounted.current&&session.phase==="ready"&&session.member?.id===memberId;},[memberId]);
  const reload=useCallback(async()=>{
    const current=++sequence.current;
    setLoading(true);setError("");
    try{
      if(!canUse())throw new MemberApiError(401,"SESSION_CHANGED","로그인 상태를 확인한 뒤 다시 불러와 주세요.");
      const value=await userSession.request(`/${kind}/${encodeURIComponent(id)}`);
      if(current!==sequence.current||!canUse())return false;
      const next=parseOwnedMedia(kind,value,memberId,id);
      setThumbnail(next.postThumbnailUrl);setMedia(next.projectMedia);setEdits(Object.fromEntries(next.projectMedia.map(item=>[item.id,{altText:item.altText??"",displayOrder:String(item.displayOrder)}])));
      setUncertain(false);setNotice("");return true;
    }catch(e){if(current===sequence.current&&mounted.current){setError(e instanceof Error?e.message:"미디어를 다시 불러오지 못했습니다.");setUncertain(true);}return false;}
    finally{if(current===sequence.current&&mounted.current)setLoading(false);}
  },[canUse,kind,id,memberId,uncertain]);
  useEffect(()=>{setThumbnail(null);setMedia([]);setEdits({});},[kind,id,memberId]);
  useEffect(()=>{mounted.current=true;void reload();return()=>{mounted.current=false;sequence.current++;};},[kind,id,memberId,attempt]);
  const run=useCallback(async(action:()=>Promise<unknown>)=>{
    if(busyRef.current||uncertain||disabled||loading)return;
    if(!canUse()){setError("로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.");return;}
    busyRef.current=true;setBusy(true);setError("");setNotice("");
    try{await action();if(!canUse())return;const ok=await reload();if(!ok)setUncertain(true);else setNotice("미디어를 저장했습니다.");}
    catch(e){if(mounted.current){const result=mediaFailure(e);setError(result.message);if(result.uncertain)setUncertain(true);}}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  },[canUse,disabled,loading,reload,uncertain]);
  function chooseFile(next:File|null){setFile(next);setError("");if(next){const issue=mediaFileError(next);if(issue)setError(issue);}}
  const locked=disabled||busy||loading||uncertain||!canUse();
  const signedThumb=safeMediaUrl(thumbnail);
  return <section className="content-media" aria-labelledby={`media-heading-${kind}-${id}`}>
    <h3 id={`media-heading-${kind}-${id}`}>이미지 관리</h3>
    <p>이미지는 JPEG, PNG, WebP 형식, 10MiB 이하만 선택할 수 있습니다. 서버에서 파일 내용을 다시 검증합니다.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {uncertain&&<p role="alert">요청 결과를 확인할 때까지 변경 작업을 잠갔습니다. 아래 버튼으로 콘텐츠를 다시 조회해 주세요.</p>}
    <button className="button" type="button" disabled={busy||loading} onClick={()=>setAttempt(n=>n+1)}>{uncertain?"상태 다시 조회":"새 URL과 미디어 다시 조회"}</button>
    {loading?<p role="status">저장된 미디어를 불러오고 있어요.</p>:kind==="posts"?<div>
      {signedThumb?<img src={signedThumb} alt="글 썸네일 미리보기" width={240}/>:thumbnail!==null?<p>썸네일은 저장되어 있지만 안전한 표시 URL을 사용할 수 없습니다. 새 URL을 다시 조회해 주세요.</p>:<p>썸네일 URL이 제공되지 않았습니다. 이미지가 없거나 비공개·차단 상태라 저장된 이미지 URL이 숨겨졌을 수 있습니다.</p>}
      <label>썸네일 파일 <input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={e=>chooseFile(e.currentTarget.files?.[0]??null)}/></label>
      <button className="button" type="button" disabled={locked||!file||!!(file&&mediaFileError(file))} onClick={()=>{if(!file)return;const body=new FormData();body.append("file",file);void run(async()=>parseThumbnailResponse(await userSession.request(`/posts/${encodeURIComponent(id)}/thumbnail`,{method:"PUT",body})));}}>썸네일 업로드</button>
      {<button className="button" type="button" disabled={locked} onClick={()=>{if(window.confirm("글 썸네일을 삭제할까요?"))void run(async()=>confirmDeletion(await userSession.request(`/posts/${encodeURIComponent(id)}/thumbnail`,{method:"DELETE"})));}}>썸네일 삭제</button>}
    </div>:<>
      <div className="content-media-upload">
        <label>이미지 파일 <input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={e=>chooseFile(e.currentTarget.files?.[0]??null)}/></label>
        <label>종류 <select value={role} disabled={locked} onChange={e=>setRole(e.currentTarget.value as MediaRole)}><option value="SCREENSHOT">스크린샷</option><option value="THUMBNAIL">대표 이미지</option></select></label>
        <label>대체 텍스트 (선택, 최대 300자) <input value={altText} maxLength={600} disabled={locked} onChange={e=>setAltText(e.currentTarget.value)}/></label>
        <label>표시 순서 <input type="number" min="0" max="2147483647" step="1" value={displayOrder} disabled={locked} onChange={e=>setDisplayOrder(e.currentTarget.value)}/></label>
        <button className="button" type="button" disabled={locked||!file||!!(file&&mediaFileError(file))||!validMediaOrder(displayOrder)||!validMediaAlt(altText)||role==="THUMBNAIL"&&media.some(item=>item.mediaRole==="THUMBNAIL")} onClick={()=>{if(!file)return;const body=new FormData();body.append("file",file);body.append("mediaRole",role);body.append("displayOrder",displayOrder);if(altText.trim())body.append("altText",altText.trim());void run(async()=>{const result=parseMediaResponse(await userSession.request(`/projects/${encodeURIComponent(id)}/media`,{method:"POST",body}));if(result.mediaRole!==role)throw new MemberApiError(0,"INVALID_RESPONSE","저장된 이미지 종류를 확인하지 못했습니다.");return result;});}}>이미지 추가</button>
      </div>
      {!media.length?<p>저장된 프로젝트 이미지가 없습니다.</p>:<ul className="content-media-list">{media.map(item=>{
        const image=safeMediaUrl(item.thumbnailUrl??item.url),value=edits[item.id]??{altText:item.altText??"",displayOrder:String(item.displayOrder)};
        return <li key={item.id}>
          {image?<img src={image} alt={item.altText??"프로젝트 미디어 미리보기"} width={240}/>:<p>{item.mediaRole==="THUMBNAIL"?"대표 이미지는":"이미지는"} 저장되어 있지만 표시 URL이 없습니다. 새 URL을 다시 조회해 주세요.</p>}
          <p>{item.mediaRole==="THUMBNAIL"?"대표 이미지":"스크린샷"}</p>
          <label>대체 텍스트 (최대 300자) <input value={value.altText} maxLength={600} disabled={locked} onChange={e=>setEdits(s=>({...s,[item.id]:{...value,altText:e.currentTarget.value}}))}/></label>
          <label>표시 순서 <input type="number" min="0" max="2147483647" step="1" value={value.displayOrder} disabled={locked} onChange={e=>setEdits(s=>({...s,[item.id]:{...value,displayOrder:e.currentTarget.value}}))}/></label>
          <button className="button" type="button" disabled={locked||!validMediaOrder(value.displayOrder)||!validMediaAlt(value.altText)} onClick={()=>void run(async()=>parseMediaResponse(await userSession.request(`/projects/${encodeURIComponent(id)}/media/${encodeURIComponent(item.id)}`,{method:"PATCH",body:{altText:value.altText.trim()||null,displayOrder:mediaOrder(value.displayOrder)}}),item.id))}>설명과 순서 저장</button>
          <button className="button" type="button" disabled={locked} onClick={()=>{if(window.confirm("이 프로젝트 이미지를 삭제할까요?"))void run(async()=>confirmDeletion(await userSession.request(`/projects/${encodeURIComponent(id)}/media/${encodeURIComponent(item.id)}`,{method:"DELETE"})));}}>삭제</button>
        </li>;
      })}</ul>}
    </>}
  </section>;
}

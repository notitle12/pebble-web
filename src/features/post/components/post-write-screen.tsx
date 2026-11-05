"use client";
import {useWriterAutosave} from "@/lib/use-writer-autosave";
import {WriterRecovery} from "@/components/writer-recovery";
import {manualPostDraftStore,cleanDraftValue,validDraftValue,type PostDraftSettings} from "@/lib/writer-drafts";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {WriterLogoutBoundary} from "@/features/auth/components/writer-logout-boundary";
import {AccountMenu} from "@/features/auth/components/account-menu";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseOwnPost,postId,type OwnPost} from "../api/member-posts";
import {apiUrl,MemberApiError,responseData} from "@/lib/member-api";
import {safeMediaUrl,mediaFileError} from "@/features/media/model";
import {PostDraftLoader} from "./post-draft-loader";
import type {SavedPostChoice} from "../saved-post-drafts";
import {PostEditor,type PostEditorValue,type PostSaveAction} from "./post-editor";
import {buildPostSaveBody,editorValueFromPost,type PostSaveOptions} from "../post-editor-model";
import {postEditorExitHref} from "../editor-exit";
import {normalizeTags,restoreDraftTags} from "../post-tags";
import {getPublicTechStacks} from "../../tech-stack/api/public-tech-stacks";
import {createPendingImages} from "../pending-images";

const localKey=(memberId:string,postId:string)=>`pebble:post-edit:${memberId}:${postId}`;
function validEditorDraft(value:unknown):value is PostEditorValue{
  if(typeof value!=="object"||value===null||Array.isArray(value))return false;
  const draft=value as Record<string,unknown>;
  const nullableId=(item:unknown)=>item===undefined||item===null||typeof item==="string";
  return (draft.thumbnailImageSrc===undefined||draft.thumbnailImageSrc===null||typeof draft.thumbnailImageSrc==="string")&&typeof draft.title==="string"&&typeof draft.summary==="string"&&(draft.slug===undefined||typeof draft.slug==="string")&&nullableId(draft.categoryId)&&nullableId(draft.projectId)&&nullableId(draft.boardId)&&(draft.tags===undefined||Array.isArray(draft.tags)&&draft.tags.every(item=>typeof item==="string"))&&Array.isArray(draft.blocks)&&draft.blocks.length>0&&draft.blocks.every(item=>{
    if(typeof item!=="object"||item===null||Array.isArray(item))return false;
    const block=item as Record<string,unknown>;
    return typeof block.key==="string"&&["TEXT","CODE","TABLE","ARCHITECTURE","DB_SCHEMA","HTML","MARKDOWN"].includes(String(block.type))&&typeof block.content==="string"&&typeof block.valid==="boolean"&&(block.language===null||typeof block.language==="string")&&(block.title===null||typeof block.title==="string")&&(block.imagePreviews===undefined||typeof block.imagePreviews==="object"&&block.imagePreviews!==null&&!Array.isArray(block.imagePreviews)&&Object.values(block.imagePreviews).every(value=>typeof value==="string"));
  });
}
function imageEndpoint(postIdValue:string,imageId:string){return apiUrl(`/posts/${encodeURIComponent(postIdValue)}/images/${encodeURIComponent(imageId)}/content`).href;}
function previewMap(value:unknown,id:string):Record<string,string>{
  if(typeof value!=="object"||value===null||!("data" in value)||!Array.isArray(value.data))throw new MemberApiError(0,"INVALID_RESPONSE","글 이미지를 확인하지 못했습니다.");
  const map:Record<string,string>={};
  for(const image of value.data){if(typeof image!=="object"||image===null||!("id" in image)||typeof image.id!=="string"||!(/^[1-9]\d{0,18}$/.test(image.id))||!("url" in image)||typeof image.url!=="string")throw new MemberApiError(0,"INVALID_RESPONSE","글 이미지 주소를 확인하지 못했습니다.");const url=safeMediaUrl(image.url);if(url)map[imageEndpoint(id,image.id)]=url;}
  return map;
}
function parseImageUpload(value:unknown,postIdValue:string):{id:string;src:string;url:string}{
  const data=responseData(value);
  if(typeof data.id!=="string"||!(/^[1-9]\d{0,18}$/.test(data.id))||typeof data.url!=="string"||!safeMediaUrl(data.url))throw new MemberApiError(0,"INVALID_RESPONSE","업로드한 이미지 주소를 확인하지 못했습니다.");
  return {id:data.id,src:imageEndpoint(postIdValue,data.id),url:safeMediaUrl(data.url)!};
}

function Writer({member,id,onLogout}:{member:Member;id?:string;onLogout:(hasChanges:boolean,memberId:string)=>void}){
  const router=useRouter();
  const[post,setPost]=useState<OwnPost|null>(null),[loading,setLoading]=useState(!!id),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(""),[restoredValue,setRestoredValue]=useState<PostEditorValue|null>(null),[restoreNotice,setRestoreNotice]=useState(""),[imagePreviews,setImagePreviews]=useState<Record<string,string>>({});
  const saving=useRef(false),unsaved=useRef(false),postRef=useRef<OwnPost|null>(null),recoveredId=useRef<string|undefined>(undefined);
  const [draftValue,setDraftValue]=useState<PostEditorValue|null>(null),[draftDirty,setDraftDirty]=useState(false),[draftSettings,setDraftSettings]=useState<PostDraftSettings|undefined>(),[recovered,setRecovered]=useState(false),[loadRevision,setLoadRevision]=useState(0);
  const onDraftChange=useCallback((value:PostEditorValue,settings:PostDraftSettings,dirty:boolean)=>{setDraftValue(value);setDraftSettings(settings);setDraftDirty(dirty);},[]);
  const onDirtyChange=useCallback((dirty:boolean)=>{unsaved.current=dirty;},[]);
  const pendingImages=useRef(createPendingImages());
  useEffect(()=>()=>pendingImages.current.dispose(),[]);
  useEffect(()=>{if(!id)return;let live=true;setLoading(true);void Promise.resolve().then(()=>userSession.request(`/posts/${postId(id)}`)).then(async value=>{if(!live)return;const next=parseOwnPost(value);if(next.author.id!==member.id)throw new Error("본인 글만 수정할 수 있습니다.");postRef.current=next;setPost(next);
    if(next.draft){try{const raw=window.localStorage.getItem(localKey(member.id,id)+":tags");if(raw)setRestoredValue({...editorValueFromPost(next),tags:normalizeTags([...next.tags,...JSON.parse(raw)])});}catch{setError("이 브라우저에 저장한 태그를 복원하지 못했습니다. 다시 입력해 주세요.");}}
    try{const images=await userSession.request(`/posts/${postId(id)}/images`);const previews=previewMap(images,id);if(live)setImagePreviews(previews);}catch{if(live)setImagePreviews({});}

  }).catch(e=>{if(live)setError(e instanceof Error?e.message:"글을 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[id,member.id]);
  const autosave=useWriterAutosave<PostEditorValue>({
    scope:{memberId:member.id,kind:"post",targetId:id},enabled:!loading,dirty:draftDirty,
    signature:JSON.stringify({value:draftValue,settings:draftSettings}),
    snapshot:()=>{const value=draftValue??restoredValue??(postRef.current?editorValueFromPost(postRef.current):{title:"",summary:"",blocks:[]});return {value,settings:draftSettings,images:pendingImages.current.snapshot(value),contentId:postRef.current?.id??recoveredId.current??id};},
    onRestore:record=>{
      if(!validDraftValue("post",record.value))throw new Error("글 자동저장본을 확인해 주세요.");
      const previews=pendingImages.current.restore(record.images);recoveredId.current=record.contentId;
      setRestoredValue({...record.value,blocks:record.value.blocks.map(block=>({...block,imagePreviews:{...imagePreviews,...previews}}))});
      setDraftSettings(record.settings);setRecovered(true);setRestoreNotice("자동저장된 글을 복구했습니다.");
    },
  });
  const saveServer=useCallback(async(value:PostEditorValue,action:PostSaveAction,base:OwnPost|null=post)=>{
    if(!base&&recoveredId.current){base=parseOwnPost(await userSession.request(`/posts/${postId(recoveredId.current)}`));if(base.author.id!==member.id)throw new Error("본인 글만 저장할 수 있습니다.");}
    const target=base?.id??id;
    const storedValue={...value,title:value.title.trim()?value.title:"임시 글",slug:value.slug??""};
    const saveOptions:PostSaveOptions=action.kind==="complete"?{draft:false,finalize:base?.draft===true,visibility:action.visibility,...(action.slug.trim()?{slug:action.slug}:{})}:{draft:true,...(!target?{visibility:"HIDDEN"}:{})};
    const body=buildPostSaveBody(storedValue,base??undefined,saveOptions);
    const result=parseOwnPost(await userSession.request(target?`/posts/${postId(target)}`:"/posts",{method:target?"PATCH":"POST",body}));
    if(result.author.id!==member.id)throw new Error("저장 결과의 작성자를 확인하지 못했습니다.");
    postRef.current=result;setPost(result);
    if(!target){window.history.replaceState(null,"",`/posts/${result.id}/edit`);await autosave.saveNow().catch(()=>{});}
    return result;
  },[id,member.id,post]);
  const uploadImage=useCallback(async(file:File)=>{
    const error=mediaFileError(file);if(error)throw new Error(error);
    // Snapshot bytes so a later save does not depend on the selected disk file still existing.
    const localFile=new File([await file.arrayBuffer()],file.name,{type:file.type});
    return pendingImages.current.stage(localFile);
  },[]);
  const onSave=async(value:PostEditorValue,action:PostSaveAction):Promise<"server"|"local">=>{
    if(saving.current)throw new Error("이미 저장 중입니다.");
    saving.current=true;setBusy(true);setError("");setSaved("");
    try{
      await autosave.saveNow().catch(()=>{});
      let current=postRef.current;
      if(!current&&recoveredId.current){current=parseOwnPost(await userSession.request(`/posts/${postId(recoveredId.current)}`));if(current.author.id!==member.id)throw new Error("본인 글만 저장할 수 있습니다.");postRef.current=current;setPost(current);}
      if(pendingImages.current.has(value)&&!current){current=await saveServer(pendingImages.current.withoutPending(value),{kind:"temporary"});}
      let resolved=await pendingImages.current.resolve(value,async file=>{
        if(!current)throw new Error("이미지를 저장할 글을 찾지 못했습니다.");
        const form=new FormData();form.append("file",file);
        const uploaded=parseImageUpload(await userSession.request(`/posts/${postId(current.id)}/images`,{method:"POST",body:form}),current.id);
        const image={src:uploaded.src,previewUrl:uploaded.url};
        setImagePreviews(previews=>({...previews,[image.src]:image.previewUrl}));return image;
      });
      if(action.kind==="temporary"&&current&&!current.draft){
        await manualPostDraftStore.write({memberId:member.id,kind:"post",targetId:current.id,contentId:current.id,value:cleanDraftValue(resolved),settings:draftSettings,images:pendingImages.current.snapshot(resolved),version:1,key:`manual:${member.id}:${current.id}`,savedAt:Date.now()});
        await autosave.clear().catch(()=>{});
        setRestoredValue(resolved);setSaved("이 브라우저에 임시 저장했습니다.");return "local";
      }
      const result=await saveServer(resolved,action,current);
      if(action.kind==="temporary"){
        try{window.localStorage.setItem(localKey(member.id,result.id)+":tags",JSON.stringify(value.tags??[]));}catch{/* The server already stores the tags. */}
      }
      if(action.kind==="complete"){
        await manualPostDraftStore.remove(`manual:${member.id}:${result.id}`).catch(()=>{});
        try{window.localStorage.removeItem(localKey(member.id,result.id));window.localStorage.removeItem(localKey(member.id,result.id)+":tags");}catch{/* Browser storage may be disabled. */}
        await autosave.clear().catch(()=>{});
        const destination=action.visibility==="PUBLIC"?`/blogs/${encodeURIComponent(result.author.handle)}/posts/${encodeURIComponent(result.urlKey)}`:"/me/posts";
        router.push(destination);return "server";
      }
      await autosave.clear().catch(()=>{});
      setSaved(result.draft?"서버에 비공개 임시 글을 저장했습니다.":"서버에 저장했습니다.");return "server";
    }catch(e){await autosave.saveNow().catch(()=>{});setError(e instanceof Error?e.message:"저장하지 못했습니다.");throw e;}
    finally{saving.current=false;setBusy(false);}
  };
  const loadSavedDraft=async(choice:SavedPostChoice)=>{
    await autosave.flush();
    if(!choice.local){router.push(`/posts/${postId(choice.id)}/edit`);return;}
    const original=parseOwnPost(await userSession.request(`/posts/${postId(choice.id)}`));
    if(original.author.id!==member.id)throw new Error("본인 임시저장 글만 불러올 수 있습니다.");
    const previews=previewMap(await userSession.request(`/posts/${postId(choice.id)}/images`),choice.id);
    const localPreviews=pendingImages.current.restore(choice.local.images);
    recoveredId.current=original.id;postRef.current=original;setPost(original);setImagePreviews(previews);
    setRestoredValue({...choice.local.value,blocks:choice.local.value.blocks.map(block=>({...block,imagePreviews:{...previews,...localPreviews}}))});
    setDraftSettings(choice.local.settings);setRecovered(true);setLoadRevision(value=>value+1);setRestoreNotice("직접 임시저장한 글을 불러왔습니다.");
    window.history.replaceState(null,"",`/posts/${original.id}/edit`);
  };
  if(loading)return <section className="list-state" role="status">글을 불러오고 있어요.</section>;
  if(!autosave.ready&&!autosave.recovery.length)return <p role="status">자동저장본을 확인하고 있어요.</p>;
  if(id&&!post&&!recovered&&!autosave.recovery.length)return <section className="list-state"><h2>글을 열지 못했어요</h2><p role="alert">{error}</p><Link className="button" href="/me/posts">내 글로 돌아가기</Link></section>;
  const baseline=post?editorValueFromPost({...post,imagePreviews}):undefined;
  const editorValue=restoredValue?{...restoredValue,blocks:restoredValue.blocks.map(block=>({...block,imagePreviews:{...block.imagePreviews,...imagePreviews}}))}:baseline;
  return <>{!autosave.ready&&<WriterRecovery records={autosave.recovery} onRestore={autosave.restore} onFresh={autosave.fresh} error={autosave.error}/>}<div className="writer-identity"><span>{member.nickname}</span><AccountMenu member={member} logoutDisabled={busy} onLogout={()=>onLogout(unsaved.current,member.id)}/></div><h1 className="writer-screen-heading writer-visually-hidden">{post?(post.draft?"임시 글 수정":"게시글 수정"):"새 게시글"}</h1><div className="writer-status writer-visually-hidden"><Link href="/me/posts">← 내 글</Link><p>{post?.draft?"비공개 임시 글을 작성하고 있습니다.":post?.visibilityStatus==="PUBLIC"?"공개 글을 수정하고 있습니다. 임시저장은 이 브라우저에 보관됩니다.":"글 제목과 본문을 작성하세요."}</p>{post?.isBlocked&&<p role="alert">관리자에 의해 차단된 글입니다. 작성자가 차단을 해제할 수 없습니다.</p>}</div>{error&&<p className="table-editor-error" role="alert">{error}</p>}{saved&&<p className="writer-visually-hidden" role="status">{saved}</p>}
    {autosave.error&&<p className="writer-autosave-error" role="alert">{autosave.error} <button type="button" onClick={()=>void autosave.saveNow().catch(()=>{})}>다시 시도</button></p>}
    <PostEditor draftLoader={<PostDraftLoader memberId={member.id} disabled={busy} onSelect={loadSavedDraft}/>} onDraftChange={onDraftChange} initialSettings={draftSettings} initialDirty={recovered} autosaveStatus={autosave.status} key={`${member.id}:${id??"new"}:${loadRevision}:${autosave.restoreRevision}`} memberId={member.id} initialValue={editorValue} initialNotice={restoreNotice} onDirtyChange={onDirtyChange} onExit={()=>router.replace(postEditorExitHref(post))} busy={busy} existingCategory={post?.category} existingPost={post?{id:post.id,draft:post.draft,urlKey:post.urlKey}:undefined} visibility={post?.visibilityStatus??"HIDDEN"} blocked={post?.isBlocked??false} uploadImage={uploadImage} onSave={onSave}/>
  </>;
}
export function PostWriteScreen({id}:{id?:string}){return <WriterLogoutBoundary>{onLogout=><MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??"new"}`} member={member} id={id} onLogout={onLogout}/>}</MemberGate>}</WriterLogoutBoundary>;}

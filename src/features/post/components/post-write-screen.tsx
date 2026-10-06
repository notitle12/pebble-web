"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseOwnPost,postId,type OwnPost} from "../api/member-posts";
import {apiUrl,MemberApiError,responseData} from "@/lib/member-api";
import {safeMediaUrl} from "@/features/media/model";
import {PostEditor,type PostEditorValue,type PostSaveAction} from "./post-editor";
import {buildPostSaveBody,editorValueFromPost,type PostSaveOptions} from "../post-editor-model";
import {ContentMedia} from "@/features/media/components/content-media";

const localKey=(memberId:string,postId:string)=>`pebble:post-edit:${memberId}:${postId}`;
function validEditorDraft(value:unknown):value is PostEditorValue{
  if(typeof value!=="object"||value===null||Array.isArray(value))return false;
  const draft=value as Record<string,unknown>;
  const nullableId=(item:unknown)=>item===undefined||item===null||typeof item==="string";
  return typeof draft.title==="string"&&typeof draft.summary==="string"&&(draft.slug===undefined||typeof draft.slug==="string")&&nullableId(draft.categoryId)&&nullableId(draft.projectId)&&nullableId(draft.boardId)&&(draft.tagIds===undefined||Array.isArray(draft.tagIds)&&draft.tagIds.every(item=>typeof item==="string"))&&Array.isArray(draft.blocks)&&draft.blocks.length>0&&draft.blocks.every(item=>{
    if(typeof item!=="object"||item===null||Array.isArray(item))return false;
    const block=item as Record<string,unknown>;
    return typeof block.key==="string"&&["TEXT","CODE","TABLE","ARCHITECTURE","HTML","MARKDOWN"].includes(String(block.type))&&typeof block.content==="string"&&typeof block.valid==="boolean"&&(block.language===null||typeof block.language==="string")&&(block.title===null||typeof block.title==="string")&&(block.imagePreviews===undefined||typeof block.imagePreviews==="object"&&block.imagePreviews!==null&&!Array.isArray(block.imagePreviews)&&Object.values(block.imagePreviews).every(value=>typeof value==="string"));
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

function Writer({member,id}:{member:Member;id?:string}){
  const router=useRouter();
  const[post,setPost]=useState<OwnPost|null>(null),[loading,setLoading]=useState(!!id),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(""),[restoredValue,setRestoredValue]=useState<PostEditorValue|null>(null),[restoreNotice,setRestoreNotice]=useState(""),[imagePreviews,setImagePreviews]=useState<Record<string,string>>({});
  const saving=useRef(false),restored=useRef(false);
  useEffect(()=>{if(!id)return;let live=true;setLoading(true);void Promise.resolve().then(()=>userSession.request(`/posts/${postId(id)}`)).then(async value=>{if(!live)return;const next=parseOwnPost(value);if(next.author.id!==member.id)throw new Error("본인 글만 수정할 수 있습니다.");setPost(next);
    try{const images=await userSession.request(`/posts/${postId(id)}/images`);const previews=previewMap(images,id);if(live)setImagePreviews(previews);}catch{if(live)setImagePreviews({});}
    if(!restored.current&&!next.draft){restored.current=true;try{const raw=window.localStorage.getItem(localKey(member.id,id));if(raw){const parsed:unknown=JSON.parse(raw);if(validEditorDraft(parsed)&&window.confirm("이 브라우저에 임시 저장한 편집 내용을 복원할까요?")){setRestoredValue({...parsed,slug:editorValueFromPost(next).slug,blocks:parsed.blocks.map(block=>({...block,imagePreviews}))});setRestoreNotice("이 브라우저에 임시 저장한 편집 내용을 복원했습니다.");}else if(!validEditorDraft(parsed))window.localStorage.removeItem(localKey(member.id,id));}}catch{setError("브라우저 임시 저장 내용을 읽지 못했습니다. 서버에 저장된 글은 그대로 열었습니다.");}}
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:"글을 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[id,member.id]);
  const saveServer=useCallback(async(value:PostEditorValue,action:PostSaveAction)=>{
    const target=post?.id??id;
    const storedValue={...value,title:value.title.trim()?value.title:"임시 글",slug:value.slug??""};
    const saveOptions:PostSaveOptions=action.kind==="complete"?{draft:false,finalize:post?.draft===true,visibility:action.visibility,...(action.slug.trim()?{slug:action.slug}:{})}:{draft:true,...(!target?{visibility:"HIDDEN"}:{})};
    const body=buildPostSaveBody(storedValue,post??undefined,saveOptions);
    const result=parseOwnPost(await userSession.request(target?`/posts/${postId(target)}`:"/posts",{method:target?"PATCH":"POST",body}));
    if(result.author.id!==member.id)throw new Error("저장 결과의 작성자를 확인하지 못했습니다.");
    setPost(result);
    if(!target)window.history.replaceState(null,"",`/posts/${result.id}/edit`);
    return result;
  },[id,member.id,post]);
  const uploadImage=useCallback(async(file:File,value:PostEditorValue)=>{
    if(saving.current)throw new Error("글 저장이 진행 중입니다. 잠시 뒤 다시 시도해 주세요.");
    saving.current=true;setBusy(true);setError("");
    try{
      let current=post;
      if(!current){current=await saveServer(value,{kind:"temporary"});}
      const form=new FormData();form.append("file",file);
      const uploaded=parseImageUpload(await userSession.request(`/posts/${postId(current.id)}/images`,{method:"POST",body:form}),current.id);
      let previewUrl=uploaded.url;
      try{const currentImages=previewMap(await userSession.request(`/posts/${postId(current.id)}/images`),current.id);previewUrl=currentImages[uploaded.src]??previewUrl;}catch{/* The upload response still provides a safe URL if refreshing the signed preview fails. */}
      const image={src:uploaded.src,previewUrl};
      setImagePreviews(previews=>({...previews,[image.src]:image.previewUrl}));
      return image;
    }catch(e){const message=e instanceof Error?e.message:"이미지를 업로드하지 못했습니다.";setError(message);throw e;}
    finally{saving.current=false;setBusy(false);}
  },[post,saveServer]);
  const onSave=async(value:PostEditorValue,action:PostSaveAction):Promise<"server"|"local">=>{
    if(saving.current)throw new Error("이미 저장 중입니다.");
    saving.current=true;setBusy(true);setError("");setSaved("");
    try{
      if(action.kind==="temporary"&&post&&!post.draft){
        const localValue={...value,blocks:value.blocks.map(({imagePreviews,...block})=>block)};
        window.localStorage.setItem(localKey(member.id,post.id),JSON.stringify(localValue));
        setRestoredValue(value);setSaved("이 브라우저에 임시 저장했습니다.");return "local";
      }
      const result=await saveServer(value,action);
      if(action.kind==="complete"){
        try{window.localStorage.removeItem(localKey(member.id,result.id));}catch{/* Browser storage may be disabled. */}
        const destination=action.visibility==="PUBLIC"?`/blogs/${encodeURIComponent(result.author.handle)}/posts/${encodeURIComponent(result.urlKey)}`:"/me/posts";
        router.push(destination);return "server";
      }
      setSaved(result.draft?"서버에 비공개 임시 글을 저장했습니다.":"서버에 저장했습니다.");return "server";
    }catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");throw e;}
    finally{saving.current=false;setBusy(false);}
  };
  if(loading)return <section className="list-state" role="status">글을 불러오고 있어요.</section>;
  if(id&&!post)return <section className="list-state"><h2>글을 열지 못했어요</h2><p role="alert">{error}</p><Link className="button" href="/me/posts">내 글로 돌아가기</Link></section>;
  const baseline=post?editorValueFromPost({...post,imagePreviews}):undefined;
  const editorValue=restoredValue?{...restoredValue,blocks:restoredValue.blocks.map(block=>({...block,imagePreviews:{...block.imagePreviews,...imagePreviews}}))}:baseline;
  return <><div className="writer-identity"><span>{member.nickname}</span>{safeMediaUrl(member.profileImageUrl)?<img src={safeMediaUrl(member.profileImageUrl)!} alt="프로필 사진" width={32} height={32}/>:<span className="writer-identity-avatar" aria-label="프로필 사진">{member.nickname.slice(0,1)}</span>}</div><h1 className="writer-screen-heading writer-visually-hidden">{post?(post.draft?"임시 글 수정":"게시글 수정"):"새 게시글"}</h1><div className="writer-status writer-visually-hidden"><Link href="/me/posts">← 내 글</Link><p>{post?.draft?"비공개 임시 글을 작성하고 있습니다.":post?.visibilityStatus==="PUBLIC"?"공개 글을 수정하고 있습니다. 임시저장은 이 브라우저에 보관됩니다.":"글 제목과 본문을 작성하세요."}</p>{post?.isBlocked&&<p role="alert">관리자에 의해 차단된 글입니다. 작성자가 차단을 해제할 수 없습니다.</p>}</div>{error&&<p className="table-editor-error" role="alert">{error}</p>}{saved&&<p className="writer-visually-hidden" role="status">{saved}</p>}{post?.visibilityStatus==="PUBLIC"&&!post.isBlocked&&<Link className="button writer-public-link" href={`/blogs/${post.author.handle}/posts/${post.urlKey}`} prefetch={false}>공개 글 확인</Link>}
    <PostEditor key={`${member.id}:${id??"new"}`} memberId={member.id} initialValue={editorValue} initialNotice={restoreNotice} busy={busy} existingCategory={post?.category} existingTags={post?.tags} existingPost={post?{id:post.id,draft:post.draft,urlKey:post.urlKey}:undefined} visibility={post?.visibilityStatus??"HIDDEN"} blocked={post?.isBlocked??false} uploadImage={uploadImage} onSave={onSave}/>
    {post&&<details className="writer-existing-media"><summary>대표 이미지 관리</summary><ContentMedia key={post.id} kind="posts" id={post.id} memberId={member.id} disabled={busy}/></details>}
  </>;
}
export function PostWriteScreen({id}:{id?:string}){return <MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??"new"}`} member={member} id={id}/>}</MemberGate>;}

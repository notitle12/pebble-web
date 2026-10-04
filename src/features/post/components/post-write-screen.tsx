"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseOwnPost,postId,type OwnPost} from "../api/member-posts";
import {PostEditor,type PostEditorValue} from "./post-editor";
import {buildPostSaveBody,editorValueFromPost} from "../post-editor-model";
function Writer({member,id}:{member:Member;id?:string}){
  const[post,setPost]=useState<OwnPost|null>(null),[loading,setLoading]=useState(!!id),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState("");const saving=useRef(false);
  useEffect(()=>{if(!id)return;let live=true;setLoading(true);void Promise.resolve().then(()=>userSession.request(`/posts/${postId(id)}`)).then(value=>{if(!live)return;const next=parseOwnPost(value);if(next.author.id!==member.id)throw new Error("본인 글만 수정할 수 있습니다.");setPost(next);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"글을 불러오지 못했습니다.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[id,member.id]);
  if(loading)return <section className="list-state" role="status">글을 불러오고 있어요.</section>;
  if(id&&!post)return <section className="list-state"><h2>글을 열지 못했어요</h2><p role="alert">{error}</p><Link className="button" href="/me/posts">내 글로 돌아가기</Link></section>;
  return <><h1>{id||post?"글 수정":"새 글 작성"}</h1><div className="writer-status"><Link href="/me/posts">← 내 글</Link><p>{post?.visibilityStatus==="PUBLIC"?"공개 글을 수정하고 있습니다. 저장하면 공개 본문에 반영됩니다.":"비공개로 저장한 글은 나만 볼 수 있습니다."}</p>{post?.isBlocked&&<p role="alert">관리자에 의해 차단된 글입니다. 작성자가 차단을 해제할 수 없습니다.</p>}</div>{error&&<p className="table-editor-error" role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}{post?.visibilityStatus==="PUBLIC"&&!post.isBlocked&&<Link className="button writer-public-link" href={`/blogs/${post.author.handle}/posts/${post.urlKey}`} prefetch={false}>공개 글 확인</Link>}<PostEditor initialValue={post?editorValueFromPost(post):undefined} busy={busy} existingCategory={post?.category} existingTags={post?.tags} visibility={post?.visibilityStatus??"HIDDEN"} blocked={post?.isBlocked??false} saveLabel={post?.visibilityStatus==="PUBLIC"?"수정 내용 저장":"비공개로 저장"} onSave={async (value,visibility)=>{
    if(saving.current)throw new Error("이미 저장 중입니다.");saving.current=true;setBusy(true);setError("");setSaved("");
    try{const body=buildPostSaveBody(value,post??undefined,visibility);const target=post?.id??id;const result=parseOwnPost(await userSession.request(target?`/posts/${postId(target)}`:"/posts",{method:target?"PATCH":"POST",body}));if(result.author.id!==member.id)throw new Error("저장 결과의 작성자를 확인하지 못했습니다.");setPost(result);setSaved(result.visibilityStatus==="PUBLIC"?"공개로 저장했습니다.":"비공개로 저장했습니다.");if(!target){window.history.replaceState(null,"",`/posts/${result.id}/edit`);} }
    catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");throw e;}finally{saving.current=false;setBusy(false);}
  }}/></>;
}
export function PostWriteScreen({id}:{id?:string}){return <MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??"new"}`} member={member} id={id}/>}</MemberGate>;}

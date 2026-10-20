"use client";
import {OwnPostEdit} from "./own-post-edit";
import {useEffect,useState} from "react";
import Link from "next/link";
import {MemberGate} from "@/features/auth/components/member-gate";
import {userSession,type Member} from "@/features/auth/user-session";
import {parseOwnPost,postId,type OwnPost} from "../api/member-posts";
import {apiUrl} from "@/lib/member-api";
import {ownerPostImages} from "../api/owner-post-images";
import {PostBody} from "./post-body";
import {safeMediaUrl} from "@/features/media/model";
function View({id,member}:{id:string;member:Member}){
 const [previews,setPreviews]=useState<Record<string,string>>({}),[imageError,setImageError]=useState("");
 const [post,setPost]=useState<OwnPost|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setPost(null);setError("");setPreviews({});setImageError("");async function load(){try{const value=parseOwnPost(await userSession.request(`/posts/${postId(id)}`));if(value.author.id!==member.id)throw new Error("작성한 글만 볼 수 있어요.");if(live)setPost(value);
 if(value.thumbnailImageId||value.blocks.some(block=>["HTML","MARKDOWN"].includes(block.type)&&(/<img\b|!\[/.test(block.content)))){
  try{const next=ownerPostImages(await userSession.request(`/posts/${postId(id)}/images`),id);
   if(live)setPreviews(next);
  }catch{if(live)setImageError("이미지를 불러오지 못했어요.");}
 }}catch(e){if(live)setError(e instanceof Error?e.message:"글을 불러오지 못했어요.");}}void load();return()=>{live=false;};},[id,member.id,attempt]);
 if(error)return <section className="list-state"><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button><Link className="button" href="/me/posts">게시글 관리</Link></section>;
 if(!post)return <p role="status">글을 불러오고 있어요.</p>;
 const image=safeMediaUrl(post.thumbnailUrl??null)??(post.thumbnailImageId?previews[apiUrl(`/posts/${id}/images/${post.thumbnailImageId}/content`).href]:null),date=post.publishedAt??post.createdAt;
 return <><Link className="detail-back" href={`/blogs/${post.author.handle}?view=posts`}>← 내 블로그</Link><article className="post-detail"><header><div className="post-heading-bar"><div className="post-meta"><span>{post.visibilityStatus==="HIDDEN"?"비공개 · 작성자만 볼 수 있어요":"공개"}</span><time dateTime={date}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"long",timeZone:"Asia/Seoul"}).format(new Date(date))}</time></div><OwnPostEdit postId={post.id} authorId={member.id} title={post.title}/></div><h1>{post.title}</h1>{image&&<img className="content-thumbnail" src={image} alt="글 대표 이미지"/>}</header>{imageError&&<p role="alert">{imageError} <button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></p>}<PostBody blocks={post.blocks} imagePreviews={previews}/>{post.tags.length>0&&<div className="post-reactions"><ul className="tag-list post-detail-tags" aria-label="태그">{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul></div>}</article></>;
}
export function OwnPostView({id}:{id:string}){return <MemberGate>{member=><View key={`${member.id}:${id}`} id={id} member={member}/>}</MemberGate>;}

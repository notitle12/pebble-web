"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {MemberGate} from "./member-gate";
function OpenBlog({handle}:{handle:string}){const router=useRouter();const href=`/blogs/${encodeURIComponent(handle)}`;useEffect(()=>{router.replace(href);},[href,router]);return <div className="list-state"><p role="status">내 블로그를 열고 있어요.</p><Link className="button" href={href}>내 블로그 열기</Link></div>;}
export function MyBlog(){return <MemberGate profile>{member=>member.handle?<OpenBlog handle={member.handle}/>:<p role="alert">블로그 공개 아이디를 확인하지 못했습니다.</p>}</MemberGate>;}

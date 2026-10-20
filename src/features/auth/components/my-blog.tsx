"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {LoadingIndicator} from "@/components/loading-state";
import {MemberGate} from "./member-gate";
function OpenBlog({handle}:{handle:string}){const router=useRouter();const href=`/blogs/${encodeURIComponent(handle)}`;useEffect(()=>{router.replace(href);},[href,router]);return <LoadingIndicator section label="내 블로그로 이동하는 중"/>;}
export function MyBlog(){return <MemberGate profile>{member=>member.handle?<OpenBlog handle={member.handle}/>:<p role="alert">블로그 공개 아이디를 확인하지 못했습니다.</p>}</MemberGate>;}

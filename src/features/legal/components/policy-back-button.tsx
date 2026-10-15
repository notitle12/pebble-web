"use client";
import { useRouter } from "next/navigation";
export function PolicyBackButton(){const router=useRouter();return <button type="button" className="button" onClick={()=>{if(window.history.length>1)router.back();else router.replace("/");}}>돌아가기</button>;}

"use client";
import {Suspense} from "react";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
import {policyHref,policyReturnTo} from "../navigation";

function NavigationLinks({returnTo,withBack}:{returnTo:string;withBack:boolean}) {
  return <><Link href={policyHref("/terms",returnTo)}>이용약관</Link><Link href={policyHref("/privacy",returnTo)}>개인정보 처리방침</Link>{withBack&&<><Link href="/">홈으로</Link><Link className="legal-return-link" href={returnTo} replace>돌아가기</Link></>}</>;
}
function CurrentNavigation({withBack}:{withBack:boolean}) {
  const pathname=usePathname(),search=useSearchParams();
  return <NavigationLinks returnTo={policyReturnTo(pathname,new URLSearchParams(search.toString()))} withBack={withBack}/>;
}
export function PolicyNavigation({withBack=false}:{withBack?:boolean}) {
  return <Suspense fallback={<NavigationLinks returnTo="/" withBack={withBack}/>}><CurrentNavigation withBack={withBack}/></Suspense>;
}

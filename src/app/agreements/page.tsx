import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { MemberAgreements } from "@/features/member/components/member-agreements";
import { getLegalPolicyConfig } from "@/features/legal/policy";
export const dynamic = "force-dynamic";
export const metadata = { title: "서비스 이용 동의", robots: { index: false, follow: false } };
export default async function Page() { const { ready } = await getLegalPolicyConfig(); return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><Suspense fallback={<div className="list-state" role="status">약관 화면을 불러오고 있어요.</div>}><MemberAgreements documentsReady={ready}/></Suspense></main></>; }

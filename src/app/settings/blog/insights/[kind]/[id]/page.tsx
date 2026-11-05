import {Suspense} from "react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ContentInsightDetail } from "@/features/content-insights/components/content-insight-detail";
export const metadata = { title: "콘텐츠 상세 통계", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if ((kind !== "posts" && kind !== "projects") || !/^[1-9]\d*$/.test(id)) notFound();
  return <><SiteHeader/><main className="page-shell detail-shell writer-shell"><Suspense fallback={<p role="status">인사이트를 불러오고 있어요.</p>}><ContentInsightDetail kind={kind} id={id}/></Suspense></main></>;
}

import {Suspense} from "react";
import {SiteHeader} from "@/components/site-header";
import {CategoryExplore} from "@/features/category/components/category-explore";
export const dynamic="force-dynamic";
export const metadata={title:"분류 탐색"};
export default function Explore(){return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader categories/><main id="main-content" className="page-shell editorial-shell"><section className="intro">{process.env.NODE_ENV==="development" && process.env.PEBBLE_PREVIEW_MODE==="mock" && <p className="preview-notice">목 데이터 미리보기 · 실제 분류가 아닙니다</p>}<p className="page-eyebrow">THE INDEX / 주제</p><h1>관심 있는 주제부터.</h1><p>항목을 선택하면 해당 공개 글 목록으로 이동합니다.</p></section><Suspense fallback={<p className="list-state" role="status">분류를 불러오고 있어요.</p>}><CategoryExplore/></Suspense></main><footer className="site-footer">Pebble · 함께 쌓아가는 개발 기록</footer></>;}

import {Suspense} from "react";
import {SiteHeader} from "@/components/site-header";
import {TechStackExplore} from "@/features/tech-stack/components/tech-stack-explore";
export const dynamic="force-dynamic";
export const metadata={title:"기술 스택 탐색"};
export default function Explore(){return <><a className="skip-link" href="#main-content">본문으로 바로가기</a><SiteHeader techStacks/><main id="main-content" className="page-shell editorial-shell"><section className="intro">{process.env.NODE_ENV==="development" && process.env.PEBBLE_PREVIEW_MODE==="mock" && <p className="preview-notice">목 데이터 미리보기 · 실제 기술 스택가 아닙니다</p>}<p className="page-eyebrow">THE INDEX / 기술 스택</p><h1>기술로 이어지는 기록.</h1><p>항목을 선택하면 해당 기술을 사용한 공개 프로젝트 목록으로 이동합니다.</p></section><Suspense fallback={<p className="list-state" role="status">기술 스택을 불러오고 있어요.</p>}><TechStackExplore/></Suspense></main><footer className="site-footer">Pebble · 함께 쌓아가는 개발 기록</footer></>;}

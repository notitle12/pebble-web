import Link from "next/link";
import {SiteHeader} from "@/components/site-header";
export default function MissingProject(){return <><SiteHeader/><main className="page-shell detail-shell"><section className="list-state"><h1>프로젝트를 찾을 수 없어요</h1><p>주소를 확인하거나 공개 프로젝트 목록에서 다시 찾아주세요.</p><Link className="button" href="/projects">프로젝트 목록으로</Link></section></main></>;}

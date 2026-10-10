import {SiteHeader} from "@/components/site-header";
import Link from "next/link";
export const metadata={title:"탈퇴 예약 취소",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><section className="list-state"><h1>계정 복구</h1><p>탈퇴 예약 후 7일이 지나기 전에 가입에 사용한 네이버 계정으로 로그인하면 계정이 복구되고 탈퇴 예약이 자동으로 취소됩니다.</p><Link className="button naver-login" href="/login">네이버 로그인</Link></section></main></>;}

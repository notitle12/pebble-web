import {SiteHeader} from "@/components/site-header";
import {NaverLoginButton} from "@/features/auth/components/naver-login-button";
export const metadata={title:"탈퇴 예약 취소",robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader/><main className="page-shell detail-shell"><section className="list-state"><h1>탈퇴 예약 취소</h1><p>예약 후 7일이 지나기 전에 가입에 사용한 네이버 계정으로 인증해 주세요. 일반 로그인만으로는 탈퇴가 취소되지 않습니다.</p><NaverLoginButton mode="withdrawal-cancel" label="네이버 인증 후 탈퇴 취소"/></section></main></>;}

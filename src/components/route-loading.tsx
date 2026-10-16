import {SiteHeader} from "./site-header";
import {LoadingIndicator} from "./loading-state";
import styles from "./loading-state.module.css";

export function RouteLoading(){
  return <>
    <a className="skip-link" href="#main-content">본문으로 바로가기</a>
    <SiteHeader/>
    <main id="main-content" className={`page-shell ${styles.routeMain}`} aria-busy="true">
      <LoadingIndicator label="페이지를 불러오는 중"/>
    </main>
  </>;
}

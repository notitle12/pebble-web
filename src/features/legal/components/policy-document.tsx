import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { PolicyNavigation } from "./policy-navigation";

export function PolicyDocument({title,version,children}:{title:string;version:string;children:ReactNode}) {
 return <><SiteHeader/><main className="page-shell legal-shell" id="main-content"><article className="legal-document">
  <header><p className="legal-eyebrow">PEBBLE</p><h1>{title}</h1><p className="legal-version">문서 버전 {version}</p></header>
  {children}
  <footer className="legal-document-footer"><PolicyNavigation withBack/></footer>
 </article></main></>;
}

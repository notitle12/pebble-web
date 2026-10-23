import type { Metadata } from "next";
import {SITE_ORIGIN,SITE_DESCRIPTION,SHARE_IMAGE} from "@/features/seo/model";
import {siteVerification} from "@/features/seo/verification";
import { Suspense, type ReactNode } from "react";
import {ContentSourceContext} from "../features/content-insights/components/content-source-context";
import {LoginDialog} from "../features/auth/components/login-dialog";
import {SiteFooter} from "../components/site-footer";
import "./globals.css";
import "./design.css";
import "./theme.css";
import "./post-typography.css";
import {themeBootstrap} from "../features/appearance/theme";

export const metadata: Metadata = {
  title: { default: "Pebble", template: "%s | Pebble" },
  metadataBase:new URL(SITE_ORIGIN),
  description:SITE_DESCRIPTION,
  applicationName:"Pebble",
  openGraph:{type:"website",siteName:"Pebble",locale:"ko_KR",title:"Pebble",description:SITE_DESCRIPTION,images:[{url:SHARE_IMAGE,width:1200,height:630,alt:"Pebble"}]},
  twitter:{card:"summary_large_image",title:"Pebble",description:SITE_DESCRIPTION,images:[SHARE_IMAGE]},
  verification:siteVerification({
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    NEXT_PUBLIC_NAVER_SITE_VERIFICATION:process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ?? "d134afca81131eb73f949e28cae18435f36dea35",
    NEXT_PUBLIC_BING_SITE_VERIFICATION:process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  }),
  icons: { icon: "/pebble-logo.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/fonts/jetbrains-mono/jetbrains-mono.css" />
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css"/>
        <script dangerouslySetInnerHTML={{__html:themeBootstrap}}/>
      </head>
      <body><Suspense fallback={null}><ContentSourceContext/></Suspense>{children}<SiteFooter/><LoginDialog showTrigger={false}/></body>
    </html>
  );
}

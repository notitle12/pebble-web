import type { Metadata } from "next";
import type { ReactNode } from "react";
import {SiteFooter} from "../components/site-footer";
import "./globals.css";
import "./design.css";
import "./theme.css";
import {themeBootstrap} from "../features/appearance/theme";

export const metadata: Metadata = {
  title: { default: "Pebble", template: "%s | Pebble" },
  description: "개발자의 기록과 프로젝트를 연결하는 공간",
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
      <body>{children}<SiteFooter/></body>
    </html>
  );
}

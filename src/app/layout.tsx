import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = {
  title: { default: "Pebble", template: "%s | Pebble" },
  description: "개발자의 기록과 프로젝트를 연결하는 공간",
  icons: { icon: "/pebble-logo.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

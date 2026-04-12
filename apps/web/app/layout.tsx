import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Vibe",
  description: "AI collaboration simulator for learning teams"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      {/* 확장 프로그램이 body에 속성을 붙이면 하이드레이션 불일치가 납니다(cz-shortcut-listen 등). */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

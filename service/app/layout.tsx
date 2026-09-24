import type { Metadata } from "next";
import { Header } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "리드요 — 분양 현장 구인정보",
  description:
    "아파트 분양 현장과 모집 조건을 비교하고 모집자에게 직접 연락하세요.",
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip" href="#main">
          본문으로 이동
        </a>
        <Header />
        {children}
      </body>
    </html>
  );
}

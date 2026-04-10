import Link from "next/link";
import { ApiStatus } from "./api-status";

const checkpoints = [
  "요구사항 승인",
  "API 계약 승인",
  "PR 리뷰 반영",
  "회고 리포트 생성"
];

export default function HomePage() {
  return (
    <main style={{ fontFamily: "sans-serif", margin: "40px auto", maxWidth: 840 }}>
      <h1>US Vibe Collaboration Simulator</h1>
      <p>백엔드 1인 학습자가 PM/FE/Senior/QA와 협업 루프를 경험하는 MVP 시작점입니다.</p>

      <ApiStatus />

      <p style={{ marginTop: 20 }}>
        <Link href="/simulate" style={{ color: "#2563eb", fontWeight: 600 }}>
          시뮬레이션 콘솔 열기
        </Link>
        <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 14 }}>
          (세션 생성 · 단계별 API · 타임라인 폴링)
        </span>
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Current Sprint Gates</h2>
        <ul>
          {checkpoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

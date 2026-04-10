import Link from "next/link";
import { WorkspaceApp } from "@/components/workspace/workspace-app";

export default function HomePage() {
  return (
    <>
      <div
        style={{
          fontFamily: "sans-serif",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "8px 16px"
        }}
      >
        <Link href="/simulate" style={{ color: "#2563eb", fontSize: 14, fontWeight: 600 }}>
          백엔드 시뮬레이션 API 콘솔 (/simulate)
        </Link>
      </div>
      <WorkspaceApp />
    </>
  );
}

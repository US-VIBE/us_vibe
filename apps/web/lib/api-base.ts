function trimBase(raw: string | undefined): string {
  const t = raw?.trim();
  return t ? t.replace(/\/$/, "") : "";
}

/**
 * 브라우저에서 호출할 **Nest API** 베이스 URL (Next와 **다른 호스트**).
 *
 * - **Netlify / Vercel 등 프론트만 호스팅:** Render·Fly·Cloud Run 등에 둔 API의 `https://…` 를
 *   `NEXT_PUBLIC_API_URL`(또는 `NEXT_PUBLIC_API_BASE_URL`)에 넣는다. (`NEXT_PUBLIC_` 이므로 빌드 시 주입)
 * - **로컬:** 변수가 없으면 `http://localhost:4000` (통합 개발용)
 * - **운영 빌드에 변수 없음:** 빈 문자열 → 같은 출처(Next)로 잘못 붙는 요청을 막기 위함
 */
export function getApiBaseUrl(): string {
  const fromUrl = trimBase(process.env.NEXT_PUBLIC_API_URL);
  if (fromUrl) {
    return fromUrl;
  }
  const fromBase = trimBase(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (fromBase) {
    return fromBase;
  }
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return "http://localhost:4000";
}

/** Netlify 등 운영에서 외부 Nest URL이 빌드에 포함됐는지 */
export function isPublicApiConfigured(): boolean {
  return Boolean(
    trimBase(process.env.NEXT_PUBLIC_API_URL) ||
      trimBase(process.env.NEXT_PUBLIC_API_BASE_URL)
  );
}

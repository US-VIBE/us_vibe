# 세션 산출물(아티팩트) 바이너리 검증

## 목적

클라이언트가 보내는 `Content-Type`/multipart MIME 문자열만 믿지 않고, **파일 시그니처(매직 바이트)**로 PNG·JPEG·WebP·PDF만 허용한다.

## 동작 요약

- `WorkspacePersistenceService.saveSessionArtifact`에서 버퍼를 검사한다.
- 검출된 종류에 맞춰 저장 MIME과 파일 확장자를 **정규화**한다.
- 시그니처 불일치 시 `ARTIFACT_SIGNATURE_INVALID` → API는 400과 한국어 메시지로 응답한다.

## 코드 위치

| 영역 | 경로 |
|------|------|
| 검증·저장 | `apps/api/src/persistence/workspace-persistence.service.ts` |
| HTTP 매핑 | `apps/api/src/session/session.controller.ts` (`uploadArtifact` 예외 처리) |

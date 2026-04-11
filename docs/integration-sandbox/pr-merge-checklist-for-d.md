# develop PR 머지 전 체크리스트 (D · 인테그레이션)

GitHub에서 PR을 열 때 [.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md)를 채우고, 아래를 확인한다.

1. **CI** — `lint`, `typecheck`, `contract-validation`, `build` 전부 녹색.
2. **역할 범위** — [team-role-charter.md](../team-role-charter.md) Deliverable Ownership (D: `.github/**`, `scripts/**`, `docs/integration-sandbox/**`, 연동).
3. **계약 변경** — OpenAPI·`specs/api-contract.md`를 수정했다면 `[contract-changed]` 라벨 및 B(백엔드) 리뷰 요청 ([team-handshake.md](../backend/team-handshake.md)).
4. **체크리스트 문서** — [checklist.md](../checklist.md)에서 해당 Gate 항목을 팀과 맞춰 갱신.
5. **머지** — base 브랜치는 `develop` ([team-role-charter.md](../team-role-charter.md) Branch & PR Rule).

실제 **Merge** 버튼은 저장소 권한이 있는 멤버가 GitHub UI에서 수행한다.

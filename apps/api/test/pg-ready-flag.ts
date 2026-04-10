import { join } from "node:path";
import { tmpdir } from "node:os";

/** `vitest.global-setup.ts`와 e2e가 공유하는 플래그 파일 경로 */
export const PG_READY_FLAG = join(tmpdir(), "usvibe-vitest-pg.ready");

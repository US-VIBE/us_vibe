import { Injectable, Logger } from "@nestjs/common";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { CollaborationService } from "../collaboration/collaboration.service";

/** 시뮬 세션 UUID 형태일 때만 Postgres `collaboration_events`에 미러링한다. */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * SQLite `integration_events` 기록 후, `sessionId`가 시뮬 UUID이면
 * `POST /collaboration/events`와 동일 테이블에 권장 `eventType`으로 append한다.
 * 실패 시 로그만 남기고 웹훅·VFS 본 흐름은 중단하지 않는다.
 *
 * 매핑 표: `docs/integration-sandbox/event-vocabulary-map.md`
 */
@Injectable()
export class IntegrationTimelineBridgeService {
  private readonly logger = new Logger(IntegrationTimelineBridgeService.name);

  constructor(private readonly collaboration: CollaborationService) {}

  async mirrorIfApplicable(resolved: IntegrationEvent): Promise<void> {
    if (!UUID_V4.test(resolved.sessionId)) {
      return;
    }
    try {
      const { eventType, payload } = this.map(resolved);
      await this.collaboration.recordEvent(eventType, payload, resolved.sessionId);
    } catch (e) {
      this.logger.warn(`Postgres timeline mirror skipped: ${(e as Error).message}`);
    }
  }

  private map(
    event: IntegrationEvent
  ): { eventType: string; payload: Record<string, unknown> } {
    const envelope: Record<string, unknown> = {
      integrationType: event.type,
      triggeredBy: event.triggeredBy,
      stateVersion: event.stateVersion,
      integrationTimestamp: event.timestamp
    };
    const payloadObj =
      typeof event.payload === "object" && event.payload !== null
        ? (event.payload as Record<string, unknown>)
        : { raw: event.payload };

    switch (event.type) {
      case "VALIDATION_FAILED":
        return {
          eventType: "contract_violation",
          payload: { ...envelope, ...payloadObj }
        };
      case "VALIDATION_PASSED":
        return {
          eventType: "review_passed",
          payload: { ...envelope, ...payloadObj }
        };
      case "PR_OPENED":
      case "PR_UPDATED":
      case "PR_MERGED":
      case "CODE_DELTA_ANALYZED":
        return {
          eventType: "supervisor_route",
          payload: { ...envelope, ...payloadObj }
        };
      case "VFS_SNAPSHOT_CREATED":
      case "VFS_APPROVED":
      case "CONTRACT_CHANGED":
        return {
          eventType: "agent_reply",
          payload: { ...envelope, ...payloadObj }
        };
      default:
        return {
          eventType: "agent_reply",
          payload: { ...envelope, ...payloadObj }
        };
    }
  }
}

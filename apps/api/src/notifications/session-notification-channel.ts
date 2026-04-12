import type { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

/** 향후 이메일·Slack 등과 병렬로 붙일 수 있는 인앱 알림 포트 */
export interface SessionNotificationChannel {
  notify(input: {
    sessionId: string;
    kind: string;
    title: string;
    body: string;
  }): void;
}

export class SqliteInAppNotificationChannel implements SessionNotificationChannel {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  notify(input: {
    sessionId: string;
    kind: string;
    title: string;
    body: string;
  }): void {
    this.workspace.appendInAppNotification(input);
  }
}

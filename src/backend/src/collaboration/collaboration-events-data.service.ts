import { CollaborationEvent } from "../entities/collaboration-event.entity";

export class CollaborationEventsDataService {
  constructor(private readonly events: any) {}

  async append(
    eventType: string,
    payload: Record<string, unknown>,
    sessionId?: string | null
  ): Promise<CollaborationEvent> {
    const row = this.events.create({
      eventType,
      payload: payload ?? {},
      sessionId: sessionId ?? null
    });
    return this.events.save(row) as Promise<CollaborationEvent>;
  }

  async listBySessionId(sessionId: string): Promise<CollaborationEvent[]> {
    return this.events.find({
      where: { sessionId },
      order: { createdAt: "ASC" }
    });
  }
}

import { CollaborationEventsDataService } from "@us-vibe/backend";
import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class CollaborationService {
  constructor(private readonly events: CollaborationEventsDataService) {}

  async recordEvent(
    eventType: string,
    payload: Record<string, unknown> | undefined,
    sessionId?: string | null
  ): Promise<{ id: string; createdAt: string }> {
    const trimmed = eventType?.trim() ?? "";
    if (!trimmed) {
      throw new BadRequestException({
        code: "VALIDATION_EVENT_TYPE",
        message: "eventType is required"
      });
    }
    const row = await this.events.append(
      trimmed,
      payload && typeof payload === "object" ? payload : {},
      sessionId ?? null
    );
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }
}

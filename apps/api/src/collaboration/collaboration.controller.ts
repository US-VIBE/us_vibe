import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CollaborationService } from "./collaboration.service";

@Controller("collaboration")
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Post("events")
  @HttpCode(HttpStatus.CREATED)
  async appendEvent(
    @Body()
    body: {
      eventType?: string;
      payload?: Record<string, unknown>;
      sessionId?: string | null;
    }
  ): Promise<{ id: string; createdAt: string }> {
    return this.collaboration.recordEvent(
      String(body.eventType ?? ""),
      body.payload,
      body.sessionId
    );
  }
}

import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  getHealth(): { ok: boolean; service: string } {
    return { ok: true, service: "us-vibe-api" };
  }
}

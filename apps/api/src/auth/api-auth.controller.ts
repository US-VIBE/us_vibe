import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./auth.types";
import { JwtAuthGuard } from "./jwt-auth.guard";

/** 웹 FE(`lib/auth-api.ts`) 계약: `/api/auth/*`, `{ ok, data: { accessToken, user } }` */
const DEFAULT_ROLE = "learner" as const;

type AuthedRequest = Request & { user: JwtPayload };

@Controller("api/auth")
export class ApiAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() body: { email?: string; password?: string }) {
    const { accessToken } = await this.auth.register(
      String(body.email ?? ""),
      String(body.password ?? "")
    );
    return this.wrapToken(accessToken);
  }

  @Post("login")
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async login(@Body() body: { email?: string; password?: string }) {
    const { accessToken } = await this.auth.login(
      String(body.email ?? ""),
      String(body.password ?? "")
    );
    return this.wrapToken(accessToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return {
      ok: true,
      data: {
        user: {
          id: req.user.sub,
          email: req.user.email,
          role: DEFAULT_ROLE
        }
      }
    };
  }

  private wrapToken(accessToken: string) {
    const payload = this.jwt.decode(accessToken) as JwtPayload | null;
    if (!payload?.sub || !payload.email) {
      throw new Error("Invalid token payload");
    }
    return {
      ok: true,
      data: {
        accessToken,
        user: {
          id: payload.sub,
          email: payload.email,
          role: DEFAULT_ROLE
        }
      }
    };
  }
}

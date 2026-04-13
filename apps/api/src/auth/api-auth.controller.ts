import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./auth.types";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
  clearRefreshTokenCookie,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie
} from "./refresh-cookie.util";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";

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
  async register(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { accessToken, refreshToken } = await this.auth.register(
      body.email,
      body.password
    );
    setRefreshTokenCookie(res, refreshToken);
    return this.wrapToken(accessToken);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async login(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { accessToken, refreshToken } = await this.auth.login(
      body.email,
      body.password
    );
    setRefreshTokenCookie(res, refreshToken);
    return this.wrapToken(accessToken);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
    if (!refreshToken) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        code: "AUTH_MISSING_REFRESH",
        message: "Refresh cookie missing"
      });
    }
    const { accessToken, refreshToken: nextRefresh } =
      await this.auth.rotateRefreshSession(refreshToken);
    setRefreshTokenCookie(res, nextRefresh);
    return this.wrapToken(accessToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ ok: true }> {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token) {
      await this.auth.revokeAccessToken(token);
    }
    const rt = readCookie(request, REFRESH_COOKIE_NAME);
    if (rt) {
      await this.auth.revokeRefreshToken(rt);
    }
    clearRefreshTokenCookie(res);
    return { ok: true };
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

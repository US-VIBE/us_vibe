import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
  clearRefreshTokenCookie,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie
} from "./refresh-cookie.util";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.auth.register(body.email, body.password);
    setRefreshTokenCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post("login")
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async login(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.auth.login(body.email, body.password);
    setRefreshTokenCookie(res, tokens.refreshToken);
    return tokens;
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
}

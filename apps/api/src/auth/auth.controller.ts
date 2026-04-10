import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: { email?: string; password?: string }
  ): Promise<{ accessToken: string }> {
    return this.auth.register(String(body.email ?? ""), String(body.password ?? ""));
  }

  @Post("login")
  async login(
    @Body() body: { email?: string; password?: string }
  ): Promise<{ accessToken: string }> {
    return this.auth.login(String(body.email ?? ""), String(body.password ?? ""));
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() request: Request): Promise<{ ok: true }> {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    await this.auth.revokeAccessToken(token);
    return { ok: true };
  }
}

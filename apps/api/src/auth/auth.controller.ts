import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService, type AuthUserView } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

type AuthedRequest = Request & { user: AuthUserView };

@Controller("api/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: { email?: string; password?: string }) {
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const { accessToken, user } = await this.auth.register(email, password);
    return { ok: true, data: { accessToken, user } };
  }

  @Post("login")
  async login(@Body() body: { email?: string; password?: string }) {
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const { accessToken, user } = await this.auth.login(email, password);
    return { ok: true, data: { accessToken, user } };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return { ok: true, data: { user: req.user } };
  }
}

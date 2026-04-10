import { RevokedTokenStore } from "@us-vibe/backend";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly revokedTokens: RevokedTokenStore
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: "AUTH_MISSING_TOKEN",
        message: "Authorization Bearer token is required"
      });
    }
    const token = header.slice("Bearer ".length).trim();
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Invalid or expired access token"
      });
    }
    if (await this.revokedTokens.isRevoked(payload.jti)) {
      throw new UnauthorizedException({
        code: "TOKEN_REVOKED",
        message: "Access token has been revoked"
      });
    }
    (request as Request & { user: JwtPayload }).user = payload;
    return true;
  }
}

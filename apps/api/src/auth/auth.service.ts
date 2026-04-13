import { RevokedTokenStore, User, UsersDataService } from "@us-vibe/backend";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersData: UsersDataService,
    private readonly jwt: JwtService,
    private readonly revokedTokens: RevokedTokenStore
  ) {}

  async register(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.assertValidCredentials(email, password);
    try {
      const user = await this.usersData.createUser(email, password);
      return {
        accessToken: await this.signAccessToken(user),
        refreshToken: await this.signRefreshToken(user)
      };
    } catch (error: unknown) {
      const pgCode = AuthService.getPostgresErrorCode(error);
      if (pgCode === "23505") {
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "Email is already registered"
        });
      }
      throw error;
    }
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    const decoded = await this.jwt.verifyAsync<
      JwtPayload & { exp: number; tokenUse?: string }
    >(accessToken);
    if (decoded.tokenUse === "refresh") {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Access token required"
      });
    }
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(decoded.exp - now, 1);
    await this.revokedTokens.revoke(decoded.jti, ttl);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = await this.jwt.verifyAsync<
        JwtPayload & { exp: number; tokenUse?: string }
      >(refreshToken);
      if (decoded.tokenUse !== "refresh") {
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(decoded.exp - now, 1);
      await this.revokedTokens.revoke(decoded.jti, ttl);
    } catch {
      /* noop — 이미 무효이거나 액세스 토큰이면 무시 */
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.assertValidCredentials(email, password);
    const user = await this.usersData.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid email or password"
      });
    }
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user)
    };
  }

  /**
   * 리프레시 토큰 회전: 기존 refresh `jti` 폐기 후 새 액세스·리프레시 발급.
   */
  async rotateRefreshSession(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded: JwtPayload & { exp: number; tokenUse?: string };
    try {
      decoded = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_REFRESH",
        message: "Invalid or expired refresh token"
      });
    }
    if (decoded.tokenUse !== "refresh") {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_REFRESH",
        message: "Invalid or expired refresh token"
      });
    }
    if (await this.revokedTokens.isRevoked(decoded.jti)) {
      throw new UnauthorizedException({
        code: "TOKEN_REVOKED",
        message: "Refresh token has been revoked"
      });
    }
    const user = await this.usersData.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User no longer exists"
      });
    }
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(decoded.exp - now, 1);
    await this.revokedTokens.revoke(decoded.jti, ttl);
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user)
    };
  }

  private assertValidCredentials(email: string, password: string): void {
    const trimmedEmail = email?.trim() ?? "";
    if (!trimmedEmail.includes("@")) {
      throw new BadRequestException({
        code: "VALIDATION_EMAIL",
        message: "A valid email is required"
      });
    }
    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: "VALIDATION_PASSWORD",
        message: "Password must be at least 8 characters"
      });
    }
  }

  private static getPostgresErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }
    const driverError = (error as { driverError?: { code?: string } })
      .driverError;
    return typeof driverError?.code === "string" ? driverError.code : undefined;
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
      tokenUse: "access"
    };
    return this.jwt.signAsync(payload, { expiresIn: "15m" });
  }

  private async signRefreshToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
      tokenUse: "refresh"
    };
    return this.jwt.signAsync(payload, { expiresIn: "7d" });
  }
}

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
  ): Promise<{ accessToken: string }> {
    this.assertValidCredentials(email, password);
    try {
      const user = await this.usersData.createUser(email, password);
      return { accessToken: await this.signAccessToken(user) };
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
    const decoded = await this.jwt.verifyAsync<JwtPayload & { exp: number }>(
      accessToken
    );
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(decoded.exp - now, 1);
    await this.revokedTokens.revoke(decoded.jti, ttl);
  }

  async login(
    email: string,
    password: string
  ): Promise<{ accessToken: string }> {
    this.assertValidCredentials(email, password);
    const user = await this.usersData.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid email or password"
      });
    }
    return { accessToken: await this.signAccessToken(user) };
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
      jti: randomUUID()
    };
    return this.jwt.signAsync(payload);
  }
}

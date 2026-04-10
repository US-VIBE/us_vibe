import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { UserRole } from "./user-persistence.service";
import { UserPersistenceService } from "./user-persistence.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthUserView {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserPersistenceService,
    private readonly jwt: JwtService
  ) {}

  async register(email: string, password: string): Promise<{ accessToken: string; user: AuthUserView }> {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      throw new ConflictException("이메일 형식이 올바르지 않습니다.");
    }
    if (password.length < 8) {
      throw new ConflictException("비밀번호는 8자 이상이어야 합니다.");
    }
    if (this.users.findByEmail(e)) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }
    const hash = await bcrypt.hash(password, 10);
    const row = this.users.createUser(e, hash, "learner");
    return this.issueToken(row.id, row.email, row.role);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUserView }> {
    const row = this.users.findByEmail(email);
    if (!row) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    return this.issueToken(row.id, row.email, row.role);
  }

  private issueToken(
    id: string,
    email: string,
    role: UserRole
  ): { accessToken: string; user: AuthUserView } {
    const payload: JwtPayload = { sub: id, email, role };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: { id, email, role }
    };
  }
}

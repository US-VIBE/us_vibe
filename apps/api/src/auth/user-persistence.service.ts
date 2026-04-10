import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

export type UserRole = "learner" | "instructor" | "admin";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

@Injectable()
export class UserPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserPersistenceService.name);
  private db!: Database.Database;

  onModuleInit(): void {
    const dbPath =
      process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "usvibe.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'learner',
        created_at TEXT NOT NULL
      );
    `);
    this.logger.log(`SQLite users: ${dbPath}`);
    void this.seedAdminIfConfigured();
  }

  onModuleDestroy(): void {
    try {
      this.db?.close();
    } catch {
      /* noop */
    }
  }

  private seedAdminIfConfigured(): void {
    const email = process.env.SEED_ADMIN_EMAIL?.trim();
    const plain = process.env.SEED_ADMIN_PASSWORD?.trim();
    if (!email || !plain) return;
    if (this.findByEmail(email)) return;
    const hash = bcrypt.hashSync(plain, 10);
    this.createUser(email, hash, "admin");
    this.logger.log(`시드 관리자 계정 생성: ${email}`);
  }

  findByEmail(email: string): UserRow | null {
    const row = this.db
      .prepare(
        "SELECT id, email, password_hash, role, created_at FROM users WHERE email = ? COLLATE NOCASE"
      )
      .get(email.trim().toLowerCase()) as UserRow | undefined;
    return row ?? null;
  }

  findById(id: string): UserRow | null {
    const row = this.db
      .prepare("SELECT id, email, password_hash, role, created_at FROM users WHERE id = ?")
      .get(id) as UserRow | undefined;
    return row ?? null;
  }

  createUser(email: string, passwordHash: string, role: UserRole = "learner"): UserRow {
    const id = randomUUID();
    const created = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, email.trim().toLowerCase(), passwordHash, role, created);
    return {
      id,
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role,
      created_at: created
    };
  }
}

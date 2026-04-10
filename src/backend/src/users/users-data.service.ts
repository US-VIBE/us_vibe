import { compare, hash } from "bcryptjs";
import { User } from "../entities/user.entity";

/**
 * Nest supplies a TypeORM `Repository` from the host workspace; the parameter is
 * loosely typed so duplicate `typeorm` installs do not break assignability.
 */
export class UsersDataService {
  constructor(private readonly users: any) {}

  async createUser(email: string, password: string): Promise<User> {
    const passwordHash = await hash(password, 10);
    const row = this.users.create({
      email: email.toLowerCase().trim(),
      passwordHash
    });
    return this.users.save(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.toLowerCase().trim() }
    });
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }
    const ok = await compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }
}

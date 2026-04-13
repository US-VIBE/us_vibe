import { User, UsersDataService } from "@us-vibe/backend";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ApiAuthController } from "./api-auth.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UsersController } from "./users.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-insecure-secret",
      signOptions: { expiresIn: "15m" }
    })
  ],
  controllers: [AuthController, UsersController, ApiAuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    {
      provide: UsersDataService,
      useFactory: (repo: unknown): UsersDataService => new UsersDataService(repo),
      inject: [getRepositoryToken(User)]
    }
  ]
})
export class AuthModule {}

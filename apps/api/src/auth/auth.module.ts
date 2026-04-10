import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { UserPersistenceService } from "./user-persistence.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-us-vibe-change-me",
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, UserPersistenceService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtModule, PassportModule, JwtAuthGuard]
})
export class AuthModule {}

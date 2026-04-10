import { UsersDataService } from "@us-vibe/backend";
import { Controller, Get, NotFoundException, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "./auth.types";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersData: UsersDataService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(
    @Req() request: Request & { user: JwtPayload }
  ): Promise<{ id: string; email: string; createdAt: string }> {
    const user = await this.usersData.findById(request.user.sub);
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "User no longer exists"
      });
    }
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString()
    };
  }
}

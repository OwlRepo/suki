import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { AuthService, ACCESS_NOT_APPROVED } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sync")
  async sync(@Headers("authorization") authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const payload = await this.authService.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException("Invalid token");
    }
    try {
      const result = await this.authService.syncUser(payload.clerkId, payload.email);
      return {
        user: result.user,
        organization: result.organization,
        isNew: result.isNew,
      };
    } catch (err) {
      if (err instanceof Error && err.message === ACCESS_NOT_APPROVED) {
        throw new ForbiddenException(
          "Access is invite-only. Contact us to get started.",
        );
      }
      throw err;
    }
  }
}

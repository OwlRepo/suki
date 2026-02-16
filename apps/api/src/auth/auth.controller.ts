import { Controller, Post, Headers, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

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
    const result = await this.authService.syncUser(payload.clerkId, payload.email);
    return {
      user: result.user,
      organization: result.organization,
      isNew: result.isNew,
    };
  }
}

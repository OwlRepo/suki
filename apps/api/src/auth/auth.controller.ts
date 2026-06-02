import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";

const COOKIE_NAME = "tyvera_session";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  @Post("sign-up/start")
  async signUpStart(@Body() body: { email: string }) {
    return this.authService.startOtp(body.email, "sign_up");
  }

  @Post("sign-up/verify")
  async signUpVerify(@Body() body: { email: string; code: string; password: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtpAndSignUp(body.email, body.code, body.password);
    if (!result.ok || !result.session) return result;
    this.setSessionCookie(res, result.session.token, result.session.expiresAt);
    return { ok: true };
  }

  @Post("sign-in/password")
  async signInPassword(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signInWithPassword(body.email, body.password);
    if (!result.ok || !result.session) return result;
    this.setSessionCookie(res, result.session.token, result.session.expiresAt);
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException("No active session");
    const session = await this.authService.validateSession(token);
    if (!session) throw new UnauthorizedException("Invalid session");
    return { user: { id: session.user.id, email: session.user.email } };
  }

  @Post("sign-out")
  async signOut(
    @Headers("authorization") authHeader: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const token =
      bearer || (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (token) {
      await this.authService.signOut(token);
    }
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  @Post("sync")
  async sync(@Headers("authorization") authHeader: string | undefined, @Req() req: Request) {
    const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const token =
      (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME] ||
      tokenFromHeader;
    if (!token) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const result = await this.authService.syncFromSession(token);
    if (!result) {
      throw new UnauthorizedException("Invalid token");
    }
    return result;
  }
}

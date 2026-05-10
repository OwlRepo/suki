import { Body, Controller, Post, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { AssistantService } from "./assistant.service";

@Controller("help/assistant")
@UseGuards(ClerkAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("chat")
  async chat(
    @Body() body: { message: string; businessId?: string; threadId?: string },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");
    return this.assistant.chat({
      organizationId: orgId,
      userId,
      message: body.message ?? "",
      businessId: body.businessId,
      threadId: body.threadId,
    });
  }

  @Post("chat/stream")
  async chatStream(
    @Body() body: { message: string; businessId?: string; threadId?: string },
    @Res() res: Response,
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const events = await this.assistant.chatStream({
      organizationId: orgId,
      userId,
      message: body.message ?? "",
      businessId: body.businessId,
      threadId: body.threadId,
    });

    for (const event of events) {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}

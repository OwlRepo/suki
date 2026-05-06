import { Controller, Post, Req, Logger } from "@nestjs/common";
import { Request } from "express";

@Controller("billing")
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  @Post("webhook/paymongo")
  async handlePaymongoWebhook(@Req() req: Request) {
    void req;
    this.logger.log("PayMongo webhook ignored: free mode is enabled.");
    return { received: true, ignored: true, freeMode: true };
  }
}

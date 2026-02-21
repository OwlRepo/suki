import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiPolicyService } from "./ai-policy.service";
import { AiUsageService } from "./ai-usage.service";
import { AiExecutionService } from "./ai-execution.service";
import { AiRateLimiterService } from "./ai-rate-limiter.service";
import { AiConcurrencyService } from "./ai-concurrency.service";
import { AiIdempotencyService } from "./ai-idempotency.service";
import { AuthModule } from "../auth/auth.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";

@Module({
  imports: [AuthModule, PlanCapacityModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiPolicyService,
    AiUsageService,
    AiExecutionService,
    AiRateLimiterService,
    AiConcurrencyService,
    AiIdempotencyService,
  ],
  exports: [AiService, AiPolicyService, AiUsageService, AiExecutionService],
})
export class AiModule {}

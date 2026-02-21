import { Global, Module } from "@nestjs/common";
import { AutomationPolicyService } from "./automation-policy.service";

@Global()
@Module({
  providers: [AutomationPolicyService],
  exports: [AutomationPolicyService],
})
export class AutomationPolicyModule {}

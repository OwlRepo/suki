import { Module } from "@nestjs/common";
import { LoyaltyController } from "./loyalty.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [LoyaltyController],
})
export class LoyaltyModule {}


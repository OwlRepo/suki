import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { CustomersModule } from "../customers/customers.module";

@Module({
  imports: [CustomersModule],
  controllers: [IntakeController],
})
export class IntakeModule {}

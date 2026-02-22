import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { CustomerTemplatesService } from "./customer-templates.service";
import { AuthModule } from "../auth/auth.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [AuthModule, AutomationModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerTemplatesService],
})
export class CustomersModule {}

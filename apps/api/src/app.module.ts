import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { CustomersModule } from "./customers/customers.module";
import { InsightsModule } from "./insights/insights.module";
import { PromosModule } from "./promos/promos.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { BillingModule } from "./billing/billing.module";
import { AdminModule } from "./admin/admin.module";
import { ImportsModule } from "./imports/imports.module";
import { ActivityLogModule } from "./activity-log/activity-log.module";
import { IntakeModule } from "./intake/intake.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    HealthModule,
    AuthModule,
    OrganizationsModule,
    BusinessesModule,
    CustomersModule,
    InsightsModule,
    PromosModule,
    AppointmentsModule,
    LoyaltyModule,
    BillingModule,
    AdminModule,
    ImportsModule,
    ActivityLogModule,
    IntakeModule,
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./health/health.module";
import { PlanCapacityModule } from "./common/plan-capacity.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { UsersModule } from "./users/users.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { CustomersModule } from "./customers/customers.module";
import { InsightsModule } from "./insights/insights.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { BillingModule } from "./billing/billing.module";
import { AdminModule } from "./admin/admin.module";
import { ImportsModule } from "./imports/imports.module";
import { IntakeModule } from "./intake/intake.module";
import { MessagingModule } from "./messaging/messaging.module";
import { AiModule } from "./ai/ai.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { AutomationModule } from "./automation/automation.module";
import { AutomationPolicyModule } from "./automation/automation-policy.module";
import { SecurityModule } from "./security/security.module";
import { HelpModule } from "./help/help.module";
import { PlatformAdminModule } from "./platform-admin/platform-admin.module";
import { OperationsModule } from "./operations/operations.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PlanCapacityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    HealthModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    BusinessesModule,
    CustomersModule,
    InsightsModule,
    AppointmentsModule,
    BillingModule,
    AdminModule,
    ImportsModule,
    IntakeModule,
    MessagingModule,
    AutomationPolicyModule,
    AutomationModule,
    AiModule,
    OnboardingModule,
    SecurityModule,
    HelpModule,
    OperationsModule,
    PlatformAdminModule,
  ],
})
export class AppModule {}

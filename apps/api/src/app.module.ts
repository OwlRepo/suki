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
import { PromosModule } from "./promos/promos.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { BillingModule } from "./billing/billing.module";
import { AdminModule } from "./admin/admin.module";
import { ImportsModule } from "./imports/imports.module";
import { ActivityLogModule } from "./activity-log/activity-log.module";
import { IntakeModule } from "./intake/intake.module";
import { MessagingModule } from "./messaging/messaging.module";
import { CrmModule } from "./crm/crm.module";
import { AiModule } from "./ai/ai.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { WorkflowsModule } from "./workflows/workflows.module";
import { LicensingModule } from "./licensing/licensing.module";
import { AutomationModule } from "./automation/automation.module";
import { AutomationPolicyModule } from "./automation/automation-policy.module";
import { SecurityModule } from "./security/security.module";

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
    PromosModule,
    AppointmentsModule,
    LoyaltyModule,
    BillingModule,
    AdminModule,
    ImportsModule,
    ActivityLogModule,
    IntakeModule,
    MessagingModule,
    AutomationPolicyModule,
    AutomationModule,
    CrmModule,
    AiModule,
    OnboardingModule,
    WorkflowsModule,
    LicensingModule,
    SecurityModule,
  ],
})
export class AppModule {}

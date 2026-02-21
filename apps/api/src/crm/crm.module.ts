import { Module } from "@nestjs/common";
import { DealsController } from "./deals.controller";
import { DealsService } from "./deals.service";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { DealStagesController } from "./deal-stages.controller";
import { DealStagesService } from "./deal-stages.service";
import { CustomFieldsController } from "./custom-fields.controller";
import { CustomFieldsService } from "./custom-fields.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [
    DealsController,
    ActivitiesController,
    TasksController,
    DealStagesController,
    CustomFieldsController,
  ],
  providers: [
    DealsService,
    ActivitiesService,
    TasksService,
    DealStagesService,
    CustomFieldsService,
  ],
  exports: [
    DealsService,
    ActivitiesService,
    TasksService,
    DealStagesService,
    CustomFieldsService,
  ],
})
export class CrmModule {}

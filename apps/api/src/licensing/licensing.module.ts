import { Module } from "@nestjs/common";
import { LicensingController } from "./licensing.controller";
import { LicensingService } from "./licensing.service";
import { OtaUpdateController } from "./ota-update.controller";
import { OtaUpdateService } from "./ota-update.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [LicensingController, OtaUpdateController],
  providers: [LicensingService, OtaUpdateService],
  exports: [LicensingService, OtaUpdateService],
})
export class LicensingModule {}

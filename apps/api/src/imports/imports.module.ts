import { Module } from "@nestjs/common";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { MigrationService } from "./migration.service";
import { MappingService } from "./mapping.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService, MigrationService, MappingService],
})
export class ImportsModule {}

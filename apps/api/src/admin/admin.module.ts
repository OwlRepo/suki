import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { FounderGuard } from "../common/founder.guard";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [AdminController],
  providers: [FounderGuard],
})
export class AdminModule {}

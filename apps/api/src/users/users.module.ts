import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { WorkspaceService } from "./workspace.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class UsersModule {}

import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthBootstrapService } from "./auth.bootstrap.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthBootstrapService],
  exports: [AuthService, AuthBootstrapService],
})
export class AuthModule {}

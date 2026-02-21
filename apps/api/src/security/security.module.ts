import { Module } from "@nestjs/common";
import { PiiCryptoService } from "./pii-crypto.service";
import { AuditLogService } from "./audit-log.service";
import { PrivacyController } from "./privacy.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [PiiCryptoService, AuditLogService],
  exports: [PiiCryptoService, AuditLogService],
})
export class SecurityModule {}

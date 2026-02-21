import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { LicensingService } from "./licensing.service";

@Controller("licensing")
@UseGuards(ClerkAuthGuard)
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  @Post("activate")
  async activate(
    @Tenant("organizationId") orgId: string | undefined,
    @Body() body: {
      payload: string;
      signature: string;
      publicKey: string;
      machineFingerprint?: string;
    },
  ) {
    if (!orgId || !body.payload || !body.signature || !body.publicKey) {
      throw new BadRequestException("organizationId, payload, signature, publicKey required");
    }
    return this.licensingService.activateOnline(
      orgId,
      body.payload,
      body.signature,
      body.publicKey,
      body.machineFingerprint,
    );
  }

  @Post("attest/:activationId")
  async attest(
    @Tenant("organizationId") orgId: string | undefined,
    @Param("activationId") activationId: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.licensingService.attest(orgId, activationId);
  }

  @Post("offline/challenge")
  async createOfflineChallenge(
    @Tenant("organizationId") orgId: string | undefined,
    @Body() body: { validMinutes?: number },
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.licensingService.createOfflineChallenge(orgId, body.validMinutes ?? 120);
  }

  @Post("offline/activate")
  async activateOffline(
    @Body() body: {
      challengeId: string;
      challenge: string;
      payload: string;
      signature: string;
      publicKey: string;
      machineFingerprint?: string;
    },
  ) {
    if (
      !body.challengeId ||
      !body.challenge ||
      !body.payload ||
      !body.signature ||
      !body.publicKey
    ) {
      throw new BadRequestException(
        "challengeId, challenge, payload, signature, publicKey required",
      );
    }
    return this.licensingService.activateOffline(
      body.challengeId,
      body.challenge,
      body.payload,
      body.signature,
      body.publicKey,
      body.machineFingerprint,
    );
  }

  @Post("revoke/:activationId")
  async revoke(
    @Tenant("organizationId") orgId: string | undefined,
    @Param("activationId") activationId: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.licensingService.revoke(orgId, activationId);
  }
}

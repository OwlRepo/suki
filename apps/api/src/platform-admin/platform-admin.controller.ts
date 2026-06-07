import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  BillingAddonSku,
  ManualBillingRequestStatus,
  ManualPaymentMethod,
} from "@tyvera/types";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { PlatformAdminGuard, type PlatformAdminRequest } from "./platform-admin.guard";
import { RequirePlatformAdminPermissions } from "./platform-admin.decorator";
import { PlatformAdminBillingService } from "./platform-admin-billing.service";
import { PlatformAdminCommunicationsService } from "./platform-admin-communications.service";
import { PlatformAdminService } from "./platform-admin.service";

@Controller("platform-admin")
@UseGuards(ClerkAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platformAdminService: PlatformAdminService,
    private readonly platformAdminBillingService: PlatformAdminBillingService,
    private readonly platformAdminCommunicationsService: PlatformAdminCommunicationsService,
  ) {}

  @Get("session")
  @RequirePlatformAdminPermissions("PLATFORM_ADMIN_ACCESS")
  getSession(@Req() request: PlatformAdminRequest) {
    return this.platformAdminService.serializeSession(
      this.requirePlatformAdmin(request),
    );
  }

  @Get("organizations")
  @RequirePlatformAdminPermissions("BUSINESS_VIEW")
  listOrganizations(@Query("search") search?: string) {
    return this.platformAdminBillingService.listOrganizations({ search });
  }

  @Get("organizations/:organizationId")
  @RequirePlatformAdminPermissions("BUSINESS_VIEW")
  getOrganization(@Param("organizationId") organizationId: string) {
    return this.platformAdminBillingService.getOrganizationDetail(organizationId);
  }

  @Get("organizations/:organizationId/sms-ledger")
  @RequirePlatformAdminPermissions("SMS_CREDIT_VIEW")
  getOrganizationSmsLedger(@Param("organizationId") organizationId: string) {
    return this.platformAdminBillingService.getSmsLedger(organizationId);
  }

  @Get("billing/addons")
  @RequirePlatformAdminPermissions("BILLING_REQUEST_VIEW")
  listBillingAddons() {
    return this.platformAdminBillingService.listAddons();
  }

  @Get("communications")
  @RequirePlatformAdminPermissions("COMMUNICATION_VIEW")
  listCommunications(
    @Query("channel") channel?: "sms" | "email",
    @Query("provider") provider?: string,
    @Query("deliveryStatus")
    deliveryStatus?: "queued" | "sent" | "delivered" | "failed" | "bounced" | "rejected",
    @Query("automationKey") automationKey?: string,
    @Query("organizationId") organizationId?: string,
    @Query("businessId") businessId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.platformAdminCommunicationsService.listCommunications({
      channel,
      provider,
      deliveryStatus,
      automationKey,
      organizationId,
      businessId,
      from,
      to,
      page,
      limit,
    });
  }

  @Get("communications/summary")
  @RequirePlatformAdminPermissions("COMMUNICATION_VIEW")
  getCommunicationsSummary(
    @Query("range") range?: "24h" | "7d" | "30d",
    @Query("organizationId") organizationId?: string,
    @Query("businessId") businessId?: string,
  ) {
    return this.platformAdminCommunicationsService.getSummary({
      range,
      organizationId,
      businessId,
    });
  }

  @Get("communications/:messageEventId")
  @RequirePlatformAdminPermissions("COMMUNICATION_VIEW")
  getCommunicationDetail(@Param("messageEventId") messageEventId: string) {
    return this.platformAdminCommunicationsService.getCommunicationDetail(
      messageEventId,
    );
  }

  @Get("billing-requests")
  @RequirePlatformAdminPermissions("BILLING_REQUEST_VIEW")
  listBillingRequests(
    @Query("status") status?: ManualBillingRequestStatus | "all",
  ) {
    return this.platformAdminBillingService.listBillingRequests({ status });
  }

  @Post("billing-requests")
  @RequirePlatformAdminPermissions("BILLING_REQUEST_CREATE")
  createBillingRequest(
    @Req() request: PlatformAdminRequest,
    @Body()
    body: {
      organizationId: string;
      sku: BillingAddonSku;
      quantity: number;
      dueAt?: string | null;
      notes?: string | null;
    },
  ) {
    return this.platformAdminBillingService.createBillingRequest(
      this.requirePlatformAdmin(request),
      body,
    );
  }

  @Get("billing-requests/:billingRequestId")
  @RequirePlatformAdminPermissions("BILLING_REQUEST_VIEW")
  getBillingRequest(@Param("billingRequestId") billingRequestId: string) {
    return this.platformAdminBillingService.getBillingRequest(billingRequestId);
  }

  @Post("billing-requests/:billingRequestId/payments")
  @RequirePlatformAdminPermissions("PAYMENT_RECORD")
  recordManualPayment(
    @Req() request: PlatformAdminRequest,
    @Param("billingRequestId") billingRequestId: string,
    @Body()
    body: {
      method: ManualPaymentMethod;
      amountPhp: number;
      externalReference?: string | null;
      proofUrl?: string | null;
      notes?: string | null;
    },
  ) {
    return this.platformAdminBillingService.recordManualPayment(
      this.requirePlatformAdmin(request),
      billingRequestId,
      body,
    );
  }

  @Post("manual-payments/:paymentId/confirm-and-fulfill")
  @RequirePlatformAdminPermissions("PAYMENT_VERIFY")
  confirmAndFulfillManualPayment(
    @Req() request: PlatformAdminRequest,
    @Param("paymentId") paymentId: string,
  ) {
    return this.platformAdminBillingService.confirmAndFulfillManualPayment(
      this.requirePlatformAdmin(request),
      paymentId,
    );
  }

  @Post("manual-payments/:paymentId/reject")
  @RequirePlatformAdminPermissions("PAYMENT_REJECT")
  rejectManualPayment(
    @Req() request: PlatformAdminRequest,
    @Param("paymentId") paymentId: string,
  ) {
    return this.platformAdminBillingService.rejectManualPayment(
      this.requirePlatformAdmin(request),
      paymentId,
    );
  }

  @Post("billing-requests/:billingRequestId/void")
  @RequirePlatformAdminPermissions("BILLING_REQUEST_VOID")
  voidBillingRequest(
    @Req() request: PlatformAdminRequest,
    @Param("billingRequestId") billingRequestId: string,
  ) {
    return this.platformAdminBillingService.voidBillingRequest(
      this.requirePlatformAdmin(request),
      billingRequestId,
    );
  }

  @Post("organizations/:organizationId/sms-adjustments")
  @RequirePlatformAdminPermissions("SMS_CREDIT_VIEW")
  adjustSmsCredits(
    @Req() request: PlatformAdminRequest,
    @Param("organizationId") organizationId: string,
    @Body()
    body: {
      type: "promotional_grant" | "admin_correction";
      units: number;
      reason: string;
    },
  ) {
    return this.platformAdminBillingService.adjustSmsCredits(
      this.requirePlatformAdmin(request),
      organizationId,
      body,
    );
  }

  @Get("audit-logs")
  @RequirePlatformAdminPermissions("AUDIT_LOG_VIEW")
  listAuditLogs() {
    return this.platformAdminBillingService.listAuditLogs();
  }

  private requirePlatformAdmin(request: PlatformAdminRequest) {
    if (!request.platformAdmin) {
      throw new ForbiddenException("Platform admin access required");
    }

    return request.platformAdmin;
  }
}

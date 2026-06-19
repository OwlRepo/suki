import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  auditLogs,
  clientBillingRequests,
  getDb,
  organizations,
} from "@tyvera/database";
import type {
  ClientBillingRequestKind,
  ClientBillingRequestStatus,
  ManualBillingSku,
  PlanType,
} from "@tyvera/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import { FeatureFlagsService } from "../common/feature-flags.service";
import { resolveManualBillingSku } from "./plan-catalog";

type CreateClientBillingRequestInput = {
  organizationId: string;
  requestedByUserId: string;
  kind: ClientBillingRequestKind;
  requestedPlanType?: PlanType | null;
  requestedSku?: string | null;
  requestedQuantity?: number | null;
  note?: string | null;
};

const OPEN_STATUSES: ClientBillingRequestStatus[] = [
  "submitted",
  "under_review",
];

@Injectable()
export class ClientBillingRequestService {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  async create(input: CreateClientBillingRequestInput) {
    this.ensureManualRequestMode();
    const db = getDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1);
    if (!organization) throw new NotFoundException("Organization not found.");

    this.validateRequest(input, organization.currentPlan ?? "free");

    const [duplicate] = await db
      .select()
      .from(clientBillingRequests)
      .where(
        and(
          eq(clientBillingRequests.organizationId, input.organizationId),
          eq(clientBillingRequests.kind, input.kind),
          inArray(clientBillingRequests.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new ConflictException({
        code: "OPEN_CLIENT_BILLING_REQUEST_EXISTS",
        requestId: duplicate.id,
        kind: input.kind,
      });
    }

    const [created] = await db
      .insert(clientBillingRequests)
      .values({
        organizationId: input.organizationId,
        requestedByUserId: input.requestedByUserId,
        kind: input.kind,
        requestedPlanType: input.requestedPlanType ?? null,
        requestedSku: input.requestedSku?.trim() || null,
        requestedQuantity: input.requestedQuantity ?? null,
        note: input.note?.trim() || null,
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(auditLogs).values({
      organizationId: input.organizationId,
      actorUserId: input.requestedByUserId,
      action: "client_billing_request.created",
      entity: "client_billing_request",
      entityId: created.id,
      details: {
        kind: created.kind,
        requestedPlanType: created.requestedPlanType,
        requestedSku: created.requestedSku,
        requestedQuantity: created.requestedQuantity,
      },
    });

    return created;
  }

  async listForOrganization(organizationId: string) {
    return getDb()
      .select()
      .from(clientBillingRequests)
      .where(eq(clientBillingRequests.organizationId, organizationId))
      .orderBy(desc(clientBillingRequests.createdAt));
  }

  async cancel(organizationId: string, requestId: string) {
    const request = await this.getByIdOrThrow(requestId);
    if (request.organizationId !== organizationId) {
      throw new NotFoundException("Client billing request not found.");
    }
    if (!OPEN_STATUSES.includes(request.status)) {
      throw new ConflictException({
        code: "CLIENT_BILLING_REQUEST_NOT_OPEN",
        status: request.status,
      });
    }

    const [updated] = await getDb()
      .update(clientBillingRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(clientBillingRequests.id, requestId),
          eq(clientBillingRequests.organizationId, organizationId),
          inArray(clientBillingRequests.status, OPEN_STATUSES),
        ),
      )
      .returning();
    if (!updated) {
      throw new ConflictException("Client billing request could not be cancelled.");
    }
    return updated;
  }

  async getByIdOrThrow(requestId: string) {
    const [request] = await getDb()
      .select()
      .from(clientBillingRequests)
      .where(eq(clientBillingRequests.id, requestId))
      .limit(1);
    if (!request) {
      throw new NotFoundException("Client billing request not found.");
    }
    return request;
  }

  async listByStatus(status?: ClientBillingRequestStatus | "all" | null) {
    const db = getDb();
    return status && status !== "all"
      ? db
          .select()
          .from(clientBillingRequests)
          .where(eq(clientBillingRequests.status, status))
          .orderBy(desc(clientBillingRequests.createdAt))
      : db
          .select()
          .from(clientBillingRequests)
          .orderBy(desc(clientBillingRequests.createdAt));
  }

  async markUnderReview(requestId: string, platformAdminId: string) {
    const request = await this.getByIdOrThrow(requestId);
    if (request.status !== "submitted") {
      throw new ConflictException({
        code: "INVALID_CLIENT_BILLING_REQUEST_STATUS",
        status: request.status,
      });
    }
    return this.updateDecision(requestId, ["submitted"], {
      status: "under_review",
      reviewedByPlatformAdminId: platformAdminId,
      reviewedAt: new Date(),
    });
  }

  async markDeclined(
    requestId: string,
    platformAdminId: string,
    decisionNote: string,
  ) {
    const note = decisionNote.trim();
    if (!note) throw new BadRequestException("Decision note is required.");
    return this.updateDecision(requestId, OPEN_STATUSES, {
      status: "declined",
      reviewedByPlatformAdminId: platformAdminId,
      reviewedAt: new Date(),
      decisionNote: note,
      linkedBillingRequestId: null,
    });
  }

  async markApprovedLinked(
    requestId: string,
    platformAdminId: string,
    linkedBillingRequestId: string | null,
    decisionNote?: string | null,
  ) {
    return this.updateDecision(requestId, OPEN_STATUSES, {
      status: "approved",
      reviewedByPlatformAdminId: platformAdminId,
      reviewedAt: new Date(),
      decisionNote: decisionNote?.trim() || null,
      linkedBillingRequestId,
    });
  }

  private async updateDecision(
    requestId: string,
    allowedStatuses: ClientBillingRequestStatus[],
    values: Record<string, unknown>,
  ) {
    const [updated] = await getDb()
      .update(clientBillingRequests)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(clientBillingRequests.id, requestId),
          inArray(clientBillingRequests.status, allowedStatuses),
        ),
      )
      .returning();
    if (!updated) {
      const request = await this.getByIdOrThrow(requestId);
      throw new ConflictException({
        code: "INVALID_CLIENT_BILLING_REQUEST_STATUS",
        status: request.status,
      });
    }
    return updated;
  }

  private ensureManualRequestMode() {
    if (
      this.featureFlags.selfServeBillingEnabled() ||
      !this.featureFlags.manualBillingControlsEnabled()
    ) {
      throw new ServiceUnavailableException({
        code: "CLIENT_BILLING_REQUESTS_DISABLED",
        message: "Client billing requests are available only in manual billing mode.",
      });
    }
  }

  private validateRequest(
    input: CreateClientBillingRequestInput,
    currentPlan: PlanType,
  ) {
    if (input.kind === "plan_change") {
      if (
        !input.requestedPlanType ||
        input.requestedPlanType === "free" ||
        input.requestedPlanType === currentPlan
      ) {
        throw new BadRequestException(
          "Plan change must select a different paid plan.",
        );
      }
      if (input.requestedSku || input.requestedQuantity != null) {
        throw new BadRequestException("Plan change accepts only a plan.");
      }
      return;
    }

    if (input.kind === "sms_topup") {
      const quantity = Number(input.requestedQuantity);
      let item;
      try {
        item = resolveManualBillingSku(input.requestedSku as ManualBillingSku);
      } catch {
        throw new BadRequestException("Invalid SMS top-up SKU.");
      }
      if (
        item.purchaseKind !== "sms_segment_topup" ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        input.requestedPlanType
      ) {
        throw new BadRequestException(
          "SMS top-up requires a valid SMS SKU and positive quantity.",
        );
      }
      return;
    }

    if (input.kind === "cancellation") {
      if (currentPlan === "free") {
        throw new BadRequestException(
          "Cancellation is available only for a paid plan.",
        );
      }
      if (
        input.requestedPlanType ||
        input.requestedSku ||
        input.requestedQuantity != null
      ) {
        throw new BadRequestException(
          "Cancellation request accepts only an optional note.",
        );
      }
      return;
    }

    throw new BadRequestException("Invalid client billing request kind.");
  }
}

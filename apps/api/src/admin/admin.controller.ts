import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { sql, inArray, eq, desc, and, gte, gt, lte } from "drizzle-orm";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { FounderGuard } from "../common/founder.guard";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { getDb } from "@tyvera/database";
import { customers, businesses, appointments, promos } from "@tyvera/database";
import type { OrgBillingStatus, PlanType } from "@tyvera/types";

@Controller("admin")
@UseGuards(ClerkAuthGuard)
export class AdminController {
  constructor(
    private readonly orgBillingState: OrgBillingStateService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get("summary")
  async getSummary(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const db = getDb();
    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));
    const bizIds = bizList.map((b) => b.id);
    if (bizIds.length === 0) {
      return {
        businesses: 0,
        customers: 0,
        appointments: 0,
        promos: 0,
        customersWithVisits: 0,
      };
    }
    const custRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(inArray(customers.businessId, bizIds));
    const visitsRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          inArray(customers.businessId, bizIds),
          gt(customers.visitCount, 0),
        ),
      );
    const apptRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(inArray(appointments.businessId, bizIds));
    const promoRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promos)
      .where(inArray(promos.businessId, bizIds));
    return {
      businesses: bizList.length,
      customers: custRes[0]?.count ?? 0,
      appointments: apptRes[0]?.count ?? 0,
      promos: promoRes[0]?.count ?? 0,
      customersWithVisits: visitsRes[0]?.count ?? 0,
    };
  }

  @Get("activity")
  async getActivity(
    @Tenant("organizationId") orgId?: string,
    @Query("limit") limitStr?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const db = getDb();
    const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 50);
    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));
    const bizIds = bizList.map((b) => b.id);
    const bizMap = new Map(bizList.map((b) => [b.id, b.name]));

    const activities: { type: string; description: string; at: string; businessName?: string }[] = [];

    if (bizIds.length > 0) {
      const recentCustomers = await db
        .select({ id: customers.id, name: customers.name, businessId: customers.businessId, createdAt: customers.createdAt })
        .from(customers)
        .where(inArray(customers.businessId, bizIds))
        .orderBy(desc(customers.createdAt))
        .limit(limit);
      for (const c of recentCustomers) {
        activities.push({
          type: "customer_added",
          description: `Customer "${c.name}" added`,
          at: c.createdAt.toISOString(),
          businessName: bizMap.get(c.businessId),
        });
      }

      const recentAppointments = await db
        .select()
        .from(appointments)
        .where(inArray(appointments.businessId, bizIds))
        .orderBy(desc(appointments.updatedAt))
        .limit(limit);
      for (const a of recentAppointments) {
        activities.push({
          type: "appointment",
          description: `Appointment ${a.status} (${a.scheduledAt.toISOString().slice(0, 10)})`,
          at: a.updatedAt.toISOString(),
          businessName: bizMap.get(a.businessId),
        });
      }

      const sentPromos = await db
        .select()
        .from(promos)
        .where(inArray(promos.businessId, bizIds))
        .orderBy(desc(promos.updatedAt))
        .limit(limit);
      for (const p of sentPromos) {
        if (p.status === "sent") {
          activities.push({
            type: "promo_sent",
            description: `Promo "${p.type}" marked as sent`,
            at: p.updatedAt.toISOString(),
            businessName: bizMap.get(p.businessId),
          });
        }
      }
    }

    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { activities: activities.slice(0, limit) };
  }

  @Get("usage")
  async getUsage(
    @Tenant("organizationId") orgId?: string,
    @Query("businessId") businessId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const db = getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));
    const bizIds = bizList.map((b) => b.id);
    if (bizIds.length === 0) {
      return {
        activeCustomers: 0,
        newCustomersThisMonth: 0,
        visitsThisMonth: 0,
        promosSentThisMonth: 0,
        month: `${year}-${String(month).padStart(2, "0")}`,
      };
    }

    const targetBizIds = businessId && bizIds.includes(businessId) ? [businessId] : bizIds;

    const newCust = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          inArray(customers.businessId, targetBizIds),
          gte(customers.createdAt, startOfMonth),
          lte(customers.createdAt, endOfMonth),
        ),
      );
    const newCustomers = newCust[0]?.count ?? 0;

    const visits = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          inArray(customers.businessId, targetBizIds),
          gte(customers.lastVisitAt, startOfMonth),
          lte(customers.lastVisitAt, endOfMonth),
        ),
      );
    const visitsCount = visits[0]?.count ?? 0;

    const promoCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promos)
      .where(
        and(
          inArray(promos.businessId, targetBizIds),
          eq(promos.status, "sent"),
          gte(promos.updatedAt, startOfMonth),
          lte(promos.updatedAt, endOfMonth),
        ),
      );
    const promosSentCount = promoCount[0]?.count ?? 0;

    const totalCust = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(inArray(customers.businessId, targetBizIds));

    let upcomingAppointments: number | undefined;
    if (businessId && targetBizIds.includes(businessId)) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const upcomingRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, businessId),
            gte(appointments.scheduledAt, startOfToday),
            eq(appointments.status, "scheduled"),
          ),
        );
      upcomingAppointments = upcomingRes[0]?.count ?? 0;
    }

    const result: Record<string, unknown> = {
      activeCustomers: totalCust[0]?.count ?? 0,
      newCustomersThisMonth: newCustomers,
      visitsThisMonth: visitsCount,
      promosSentThisMonth: promosSentCount,
      month: `${year}-${String(month).padStart(2, "0")}`,
    };
    if (upcomingAppointments !== undefined) {
      result.upcomingAppointments = upcomingAppointments;
    }
    return result;
  }

  @Get("org-billing")
  @UseGuards(FounderGuard)
  async getOrgBilling(@Query("organizationId") organizationId?: string) {
    if (!organizationId) {
      throw new BadRequestException("organizationId is required");
    }
    const state = await this.orgBillingState.getOrgBillingState(organizationId);
    if (!state) {
      throw new BadRequestException("Organization not found");
    }
    const org = await this.organizationsService.findById(organizationId);
    return {
      ...state,
      trialStartsAt: org?.trialStartsAt?.toISOString() ?? null,
      trialEndsAt: org?.trialEndsAt?.toISOString() ?? null,
      nextBillingDueAt: org?.nextBillingDueAt?.toISOString() ?? null,
      accessEndsAt: org?.accessEndsAt?.toISOString() ?? null,
    };
  }

  @Patch("org-billing")
  @UseGuards(FounderGuard)
  async patchOrgBilling(
    @Body()
    body: {
      organizationId: string;
      billingStatus?: OrgBillingStatus;
      currentPlan?: PlanType;
      trialStartsAt?: string | null;
      trialEndsAt?: string | null;
      nextBillingDueAt?: string | null;
      manualBillingNotes?: string | null;
      accessEndsAt?: string | null;
    },
  ) {
    void body;
    throw new ForbiddenException("Billing changes are disabled while free mode is active.");
  }

  @Post("org-billing/extend-trial")
  @UseGuards(FounderGuard)
  async extendTrial(
    @Body() body: { organizationId?: string; days?: number },
  ) {
    void body;
    throw new ForbiddenException("Billing changes are disabled while free mode is active.");
  }
}

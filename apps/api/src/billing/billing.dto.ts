import { IsIn, IsOptional } from "class-validator";
import type { BillingAddonSku, BillingInterval, PlanType } from "@suki/types";
import { BILLING_ADDON_CATALOG, BILLING_INTERVALS } from "./plan-catalog";

const PAID_PLAN_TYPES = ["starter", "growth", "pro"] as const;
// free stays accepted so changePlan keeps its "use cancellation" message
const CHANGE_PLAN_TYPES = ["free", ...PAID_PLAN_TYPES] as const;
const ADDON_SKUS = BILLING_ADDON_CATALOG.map((addon) => addon.sku);

export class CreateCheckoutDto {
  @IsIn(PAID_PLAN_TYPES)
  planType!: Exclude<PlanType, "free">;

  @IsIn(BILLING_INTERVALS)
  billingInterval!: BillingInterval;
}

export class CreateAddonCheckoutDto {
  @IsIn(ADDON_SKUS)
  sku!: BillingAddonSku;
}

export class ChangePlanDto {
  @IsIn(CHANGE_PLAN_TYPES)
  planType!: PlanType;

  @IsOptional()
  @IsIn(BILLING_INTERVALS)
  billingInterval?: BillingInterval;
}

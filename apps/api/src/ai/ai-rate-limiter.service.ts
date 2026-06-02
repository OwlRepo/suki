import { Injectable, Logger } from "@nestjs/common";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AI_QUOTAS } from "./ai-quotas";
import type { PlanType } from "@tyvera/types";

type WindowKey = string;
const MINUTE_MS = 60_000;

@Injectable()
export class AiRateLimiterService {
  private readonly logger = new Logger(AiRateLimiterService.name);
  private readonly userWindow = new Map<WindowKey, number[]>();
  private readonly orgWindow = new Map<WindowKey, number[]>();

  constructor(private readonly planCapacity: PlanCapacityService) {}

  async allow(
    organizationId: string,
    userId: string,
    feature: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];
    if (quota.perUserRpm <= 0 && quota.perOrgRpm <= 0) {
      return { allowed: true };
    }
    const now = Date.now();
    const cutoff = now - MINUTE_MS;

    if (quota.perUserRpm > 0) {
      const key: WindowKey = `u:${userId}`;
      const timestamps = this.userWindow.get(key) ?? [];
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length >= quota.perUserRpm) {
        return { allowed: false, reason: "AI_RATE_LIMITED" };
      }
      recent.push(now);
      this.userWindow.set(key, recent);
      this.pruneUser(key, cutoff);
    }

    if (quota.perOrgRpm > 0) {
      const key: WindowKey = `o:${organizationId}`;
      const timestamps = this.orgWindow.get(key) ?? [];
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length >= quota.perOrgRpm) {
        return { allowed: false, reason: "AI_RATE_LIMITED" };
      }
      recent.push(now);
      this.orgWindow.set(key, recent);
      this.pruneOrg(key, cutoff);
    }

    return { allowed: true };
  }

  private pruneUser(key: WindowKey, cutoff: number) {
    const timestamps = this.userWindow.get(key) ?? [];
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) this.userWindow.delete(key);
    else this.userWindow.set(key, filtered);
  }

  private pruneOrg(key: WindowKey, cutoff: number) {
    const timestamps = this.orgWindow.get(key) ?? [];
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) this.orgWindow.delete(key);
    else this.orgWindow.set(key, filtered);
  }
}

import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AI_QUOTAS } from "./ai-quotas";

interface Entry {
  timestamp: number;
}

@Injectable()
export class AiIdempotencyService {
  private readonly cache = new Map<string, Entry>();

  constructor(private readonly planCapacity: PlanCapacityService) {}

  async check(
    organizationId: string,
    userId: string,
    feature: string,
    payload: unknown,
  ): Promise<{ allowed: boolean }> {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];
    const windowMs = (quota.idempotencyWindowSec ?? 60) * 1_000;
    const key = this.hashKey(organizationId, userId, feature, payload);
    const now = Date.now();
    const existing = this.cache.get(key);
    if (existing) {
      if (now - existing.timestamp < windowMs) {
        return { allowed: false };
      }
    }
    this.cache.set(key, { timestamp: now });
    this.prune(now - windowMs);
    return { allowed: true };
  }

  private hashKey(orgId: string, userId: string, feature: string, payload: unknown): string {
    const str = JSON.stringify({ orgId, userId, feature, payload });
    return createHash("sha256").update(str).digest("hex").slice(0, 32);
  }

  private prune(cutoff: number) {
    for (const [k, v] of this.cache.entries()) {
      if (v.timestamp < cutoff) this.cache.delete(k);
    }
  }
}

import { Injectable } from "@nestjs/common";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AI_QUOTAS } from "./ai-quotas";

@Injectable()
export class AiConcurrencyService {
  private readonly activeByOrg = new Map<string, number>();

  constructor(private readonly planCapacity: PlanCapacityService) {}

  async acquire(organizationId: string): Promise<{ acquired: boolean; release: () => void }> {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];
    if (quota.maxConcurrentJobs <= 0) {
      return { acquired: true, release: () => {} };
    }
    const current = this.activeByOrg.get(organizationId) ?? 0;
    if (current >= quota.maxConcurrentJobs) {
      return { acquired: false, release: () => {} };
    }
    this.activeByOrg.set(organizationId, current + 1);
    return {
      acquired: true,
      release: () => {
        const n = this.activeByOrg.get(organizationId) ?? 0;
        if (n <= 1) this.activeByOrg.delete(organizationId);
        else this.activeByOrg.set(organizationId, n - 1);
      },
    };
  }
}

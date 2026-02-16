import { Injectable } from "@nestjs/common";

export const BUSINESS_TYPE_RECOMMENDATIONS: Record<string, string[]> = {
  salon: ["crm", "appointments", "loyalty", "promos"],
  clinic: ["crm", "appointments", "promos"],
  restaurant: ["crm", "loyalty", "promos"],
  retail: ["crm", "loyalty", "promos", "ai_messaging"],
  spa: ["crm", "appointments", "loyalty"],
  gym: ["crm", "appointments", "loyalty"],
  other: ["crm", "insights", "loyalty"],
};

@Injectable()
export class RecommendationService {
  getRecommendedModules(businessType: string): string[] {
    const normalized = businessType?.toLowerCase().trim() || "other";
    return (
      BUSINESS_TYPE_RECOMMENDATIONS[normalized] ??
      BUSINESS_TYPE_RECOMMENDATIONS.other
    );
  }

  getAllBusinessTypes(): string[] {
    return Object.keys(BUSINESS_TYPE_RECOMMENDATIONS);
  }
}

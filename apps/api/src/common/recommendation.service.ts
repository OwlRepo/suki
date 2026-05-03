import { Injectable } from "@nestjs/common";

export const BUSINESS_TYPE_RECOMMENDATIONS: Record<string, string[]> = {
  salon: ["customers", "appointments", "imports", "insights"],
  clinic: ["customers", "appointments", "imports", "insights"],
  restaurant: ["customers", "appointments", "imports", "insights"],
  retail: ["customers", "appointments", "imports", "insights", "ai_messaging"],
  spa: ["customers", "appointments", "imports", "insights"],
  gym: ["customers", "appointments", "imports", "insights"],
  other: ["customers", "appointments", "imports", "insights"],
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

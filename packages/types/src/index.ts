// Plan types (Starter, Growth, AI Pro)
export type PlanType = "starter" | "growth" | "ai_pro";

export interface Plan {
  type: PlanType;
  name: string;
  pricePhp: number;
  aiCreditsPerMonth: number;
}

// Entity types
export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Business {
  id: string;
  organizationId: string;
  name: string;
  businessType: string;
  paymongoCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  clerkId: string;
  organizationId: string;
  role: "owner" | "staff";
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  mobile?: string;
  notes?: string;
  preferences?: string;
  visitCount: number;
  lastVisitAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Promo {
  id: string;
  businessId: string;
  type: "discount" | "free_addon" | "loyalty" | "reminder" | "other";
  value?: string;
  validityStart: Date;
  validityEnd: Date;
  audienceFilter?: Record<string, unknown>;
  messageContent?: string;
  status: "draft" | "sent" | "scheduled";
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  customerId: string;
  businessId: string;
  scheduledAt: Date;
  status: "scheduled" | "completed" | "missed" | "cancelled";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planType: PlanType;
  status: "active" | "cancelled" | "past_due" | "trialing";
  paymongoSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiCredits {
  id: string;
  organizationId: string;
  month: string;
  allocated: number;
  used: number;
  createdAt: Date;
  updatedAt: Date;
}

// API request/response types
export interface CreateCustomerDto {
  businessId: string;
  name: string;
  mobile?: string;
  notes?: string;
  preferences?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  mobile?: string;
  notes?: string;
  preferences?: string;
}

export interface CreatePromoDto {
  businessId: string;
  type: Promo["type"];
  value?: string;
  validityStart: Date;
  validityEnd: Date;
  audienceFilter?: Record<string, unknown>;
}

export interface CreateAppointmentDto {
  customerId: string;
  businessId: string;
  scheduledAt: Date;
  notes?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

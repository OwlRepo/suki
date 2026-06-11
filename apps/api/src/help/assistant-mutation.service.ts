import { Injectable } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type OpenAI from "openai";
import { normalizePhilippineMobileE164 } from "@tyvera/types";
import { CustomersService } from "../customers/customers.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { PlanCapacityService } from "../common/plan-capacity.service";

type AssistantMutationToolName =
  | "find_customers"
  | "list_appointments"
  | "update_customer"
  | "reschedule_appointment";

type MutationAction = "update_customer" | "reschedule_appointment";

type CustomerChanges = {
  name?: string;
  mobile?: string;
  email?: string;
  notes?: string;
  preferences?: string;
  tags?: string;
};

type ConfirmationPayload = {
  version: 1;
  action: MutationAction;
  organizationId: string;
  userId: string;
  businessId: string;
  targetId: string;
  expected: Record<string, unknown>;
  changes: Record<string, unknown>;
  expiresAt: number;
  nonce: string;
};

type ExecuteMutationToolInput = {
  organizationId: string;
  userId: string;
  businessId?: string;
  name: string;
  argumentsJson: string;
};

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function nullableString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.slice(0, maxLength);
}

function dateIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function customerSnapshot(customer: Record<string, unknown>) {
  return {
    name: customer.name ?? null,
    mobile: customer.mobile ?? null,
    email: customer.email ?? null,
    notes: customer.notes ?? null,
    preferences: customer.preferences ?? null,
    tags: customer.tags ?? null,
  };
}

function snapshotsEqual(
  current: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  return JSON.stringify(current) === JSON.stringify(expected);
}

@Injectable()
export class AssistantMutationService {
  constructor(
    private readonly customers: CustomersService,
    private readonly appointments: AppointmentsService,
    private readonly planCapacity: PlanCapacityService,
  ) {}

  getToolDefinitions(): OpenAI.Responses.Tool[] {
    return [
      {
        type: "function",
        name: "find_customers",
        description:
          "Find authenticated-business customers before proposing an update.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: { query: { type: "string", minLength: 1, maxLength: 120 } },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "list_appointments",
        description:
          "List authenticated-business appointments before proposing a reschedule.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            from: { type: ["string", "null"], format: "date-time" },
            to: { type: ["string", "null"], format: "date-time" },
          },
          required: ["from", "to"],
        },
      },
      {
        type: "function",
        name: "update_customer",
        description:
          "Propose a reversible customer profile update. Requires explicit user confirmation before execution.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            customerId: { type: "string", minLength: 1 },
            name: { type: ["string", "null"], maxLength: 160 },
            mobile: { type: ["string", "null"], maxLength: 32 },
            email: { type: ["string", "null"], maxLength: 320 },
            notes: { type: ["string", "null"], maxLength: 2000 },
            preferences: { type: ["string", "null"], maxLength: 1000 },
            tags: { type: ["string", "null"], maxLength: 500 },
          },
          required: [
            "customerId",
            "name",
            "mobile",
            "email",
            "notes",
            "preferences",
            "tags",
          ],
        },
      },
      {
        type: "function",
        name: "reschedule_appointment",
        description:
          "Propose rescheduling an existing appointment. Requires explicit user confirmation before execution.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            appointmentId: { type: "string", minLength: 1 },
            scheduledAt: { type: "string", format: "date-time" },
            notes: { type: ["string", "null"], maxLength: 2000 },
          },
          required: ["appointmentId", "scheduledAt", "notes"],
        },
      },
    ];
  }

  async executeTool(input: ExecuteMutationToolInput): Promise<{
    tool: AssistantMutationToolName | "unsupported";
    status: "ok" | "error" | "confirmation_required";
    output: unknown;
    confirmation?: {
      token: string;
      action: MutationAction;
      summary: string;
      expiresAt: string;
    };
  }> {
    if (!this.isSupportedTool(input.name)) {
      return {
        tool: "unsupported",
        status: "error",
        output: { code: "UNSUPPORTED_ASSISTANT_TOOL" },
      };
    }
    if (!input.businessId) {
      return {
        tool: input.name,
        status: "error",
        output: { code: "MISSING_BUSINESS_SCOPE" },
      };
    }

    const args = parseObject(input.argumentsJson);
    if (!args) {
      return {
        tool: input.name,
        status: "error",
        output: { code: "INVALID_ASSISTANT_TOOL_ARGUMENTS" },
      };
    }

    if (input.name === "find_customers") {
      const query = nullableString(args.query, 120);
      if (!query) {
        return {
          tool: input.name,
          status: "error",
          output: { code: "INVALID_ASSISTANT_TOOL_ARGUMENTS" },
        };
      }
      const result = await this.customers.list(
        input.businessId,
        input.organizationId,
        { search: query, limit: 10, offset: 0 },
      );
      return {
        tool: input.name,
        status: "ok",
        output: {
          customers: result.customers.slice(0, 10).map((customer) => ({
            id: customer.id,
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email,
          })),
        },
      };
    }

    if (input.name === "list_appointments") {
      const from = args.from ? new Date(String(args.from)) : undefined;
      const to = args.to ? new Date(String(args.to)) : undefined;
      if (
        (from && Number.isNaN(from.getTime())) ||
        (to && Number.isNaN(to.getTime()))
      ) {
        return {
          tool: input.name,
          status: "error",
          output: { code: "INVALID_ASSISTANT_TOOL_ARGUMENTS" },
        };
      }
      const result = await this.appointments.list(
        input.businessId,
        input.organizationId,
        { from, to, limit: 20, offset: 0 },
      );
      const items = Array.isArray(result) ? result : result.items;
      return {
        tool: input.name,
        status: "ok",
        output: {
          appointments: items.slice(0, 20).map((appointment) => ({
            id: appointment.id,
            customerId: appointment.customerId,
            scheduledAt: dateIso(appointment.scheduledAt),
            status: appointment.status,
            notes: appointment.notes,
          })),
        },
      };
    }

    if (await this.planCapacity.isReadOnly(input.organizationId)) {
      return {
        tool: input.name,
        status: "error",
        output: { code: "ACCOUNT_READ_ONLY" },
      };
    }

    if (input.name === "update_customer") {
      return this.proposeCustomerUpdate(input, args);
    }
    return this.proposeAppointmentReschedule(input, args);
  }

  async confirm(input: {
    organizationId: string;
    userId: string;
    businessId?: string;
    token: string;
  }): Promise<{
    status: "ok";
    action: MutationAction;
    result: unknown;
    alreadyApplied?: boolean;
  }> {
    const payload = this.verifyToken(input.token);
    if (
      payload.organizationId !== input.organizationId ||
      payload.userId !== input.userId ||
      payload.businessId !== input.businessId
    ) {
      throw new Error("ASSISTANT_CONFIRMATION_SCOPE_MISMATCH");
    }
    if (payload.expiresAt < Date.now()) {
      throw new Error("ASSISTANT_CONFIRMATION_EXPIRED");
    }
    if (await this.planCapacity.isReadOnly(input.organizationId)) {
      throw new Error("ACCOUNT_READ_ONLY");
    }

    if (payload.action === "update_customer") {
      const current = await this.customers.findById(
        payload.targetId,
        input.organizationId,
      );
      if (!current || current.businessId !== payload.businessId) {
        throw new Error("ASSISTANT_TARGET_OUT_OF_SCOPE");
      }
      const snapshot = customerSnapshot(current as Record<string, unknown>);
      const changes = payload.changes as CustomerChanges;
      if (this.customerChangesApplied(snapshot, changes)) {
        return {
          status: "ok",
          action: payload.action,
          result: current,
          alreadyApplied: true,
        };
      }
      if (!snapshotsEqual(snapshot, payload.expected)) {
        throw new Error("ASSISTANT_CONFIRMATION_STALE");
      }
      const result = await this.customers.update(
        payload.targetId,
        input.organizationId,
        changes,
      );
      return { status: "ok", action: payload.action, result };
    }

    const current = await this.appointments.findById(
      payload.targetId,
      input.organizationId,
    );
    if (!current || current.businessId !== payload.businessId) {
      throw new Error("ASSISTANT_TARGET_OUT_OF_SCOPE");
    }
    const snapshot = {
      scheduledAt: dateIso(current.scheduledAt),
      notes: current.notes ?? null,
      visitRecordedAt: dateIso(current.visitRecordedAt),
    };
    const scheduledAt = new Date(String(payload.changes.scheduledAt));
    const notes =
      typeof payload.changes.notes === "string"
        ? payload.changes.notes
        : undefined;
    if (
      snapshot.scheduledAt === scheduledAt.toISOString() &&
      (notes === undefined || snapshot.notes === notes)
    ) {
      return {
        status: "ok",
        action: payload.action,
        result: current,
        alreadyApplied: true,
      };
    }
    if (!snapshotsEqual(snapshot, payload.expected)) {
      throw new Error("ASSISTANT_CONFIRMATION_STALE");
    }
    const result = await this.appointments.update(
      payload.targetId,
      input.organizationId,
      { scheduledAt, ...(notes !== undefined && { notes }) },
    );
    return { status: "ok", action: payload.action, result };
  }

  private async proposeCustomerUpdate(
    input: ExecuteMutationToolInput & { businessId?: string },
    args: Record<string, unknown>,
  ) {
    const customerId = nullableString(args.customerId, 100);
    if (!customerId || !input.businessId) {
      return this.invalidArguments("update_customer");
    }
    const current = await this.customers.findById(
      customerId,
      input.organizationId,
    );
    if (!current || current.businessId !== input.businessId) {
      return this.outOfScope("update_customer");
    }

    const changes: CustomerChanges = {};
    const name = nullableString(args.name, 160);
    const mobileInput = nullableString(args.mobile, 32);
    const email = nullableString(args.email, 320);
    const notes = nullableString(args.notes, 2000);
    const preferences = nullableString(args.preferences, 1000);
    const tags = nullableString(args.tags, 500);
    if (name) changes.name = name;
    if (mobileInput) {
      const mobile = normalizePhilippineMobileE164(mobileInput);
      if (!mobile) return this.invalidArguments("update_customer");
      changes.mobile = mobile;
    }
    if (email !== undefined) changes.email = email;
    if (notes !== undefined) changes.notes = notes;
    if (preferences !== undefined) changes.preferences = preferences;
    if (tags !== undefined) changes.tags = tags;
    if (Object.keys(changes).length === 0) {
      return this.invalidArguments("update_customer");
    }

    const summary = `Update customer ${current.name}: ${Object.entries(changes)
      .map(([key, value]) => `${key} to ${String(value)}`)
      .join(", ")}`;
    return this.createProposal({
      action: "update_customer",
      input,
      targetId: customerId,
      expected: customerSnapshot(current as Record<string, unknown>),
      changes,
      summary,
    });
  }

  private async proposeAppointmentReschedule(
    input: ExecuteMutationToolInput & { businessId?: string },
    args: Record<string, unknown>,
  ) {
    const appointmentId = nullableString(args.appointmentId, 100);
    const scheduledAt = new Date(String(args.scheduledAt ?? ""));
    const notes = nullableString(args.notes, 2000);
    if (
      !appointmentId ||
      !input.businessId ||
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt.getTime() <= Date.now()
    ) {
      return this.invalidArguments("reschedule_appointment");
    }
    const current = await this.appointments.findById(
      appointmentId,
      input.organizationId,
    );
    if (!current || current.businessId !== input.businessId) {
      return this.outOfScope("reschedule_appointment");
    }
    if (current.visitRecordedAt) {
      return {
        tool: "reschedule_appointment" as const,
        status: "error" as const,
        output: { code: "COMPLETED_APPOINTMENT_NOT_MUTABLE" },
      };
    }
    const changes = {
      scheduledAt: scheduledAt.toISOString(),
      ...(notes !== undefined && { notes }),
    };
    return this.createProposal({
      action: "reschedule_appointment",
      input,
      targetId: appointmentId,
      expected: {
        scheduledAt: dateIso(current.scheduledAt),
        notes: current.notes ?? null,
        visitRecordedAt: dateIso(current.visitRecordedAt),
      },
      changes,
      summary: `Reschedule appointment to ${scheduledAt.toISOString()}${
        notes !== undefined ? ` with notes "${notes}"` : ""
      }`,
    });
  }

  private createProposal(input: {
    action: MutationAction;
    input: ExecuteMutationToolInput & { businessId?: string };
    targetId: string;
    expected: Record<string, unknown>;
    changes: Record<string, unknown>;
    summary: string;
  }) {
    if (!input.input.businessId || !this.secret()) {
      return {
        tool: input.action,
        status: "error" as const,
        output: { code: "ASSISTANT_MUTATIONS_NOT_CONFIGURED" },
      };
    }
    const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
    const payload: ConfirmationPayload = {
      version: 1,
      action: input.action,
      organizationId: input.input.organizationId,
      userId: input.input.userId,
      businessId: input.input.businessId,
      targetId: input.targetId,
      expected: input.expected,
      changes: input.changes,
      expiresAt,
      nonce: randomUUID(),
    };
    const token = this.signPayload(payload);
    return {
      tool: input.action,
      status: "confirmation_required" as const,
      output: {
        code: "CONFIRMATION_REQUIRED",
        action: input.action,
        summary: input.summary,
      },
      confirmation: {
        token,
        action: input.action,
        summary: input.summary,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    };
  }

  private signPayload(payload: ConfirmationPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.secret()!)
      .update(encoded)
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  private verifyToken(token: string): ConfirmationPayload {
    const [encoded, providedSignature, extra] = token.split(".");
    const secret = this.secret();
    if (!encoded || !providedSignature || extra || !secret) {
      throw new Error("ASSISTANT_CONFIRMATION_INVALID");
    }
    const expectedSignature = createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new Error("ASSISTANT_CONFIRMATION_INVALID");
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as ConfirmationPayload;
      if (
        payload.version !== 1 ||
        !payload.action ||
        !payload.organizationId ||
        !payload.userId ||
        !payload.businessId ||
        !payload.targetId ||
        typeof payload.expiresAt !== "number"
      ) {
        throw new Error("invalid");
      }
      return payload;
    } catch {
      throw new Error("ASSISTANT_CONFIRMATION_INVALID");
    }
  }

  private customerChangesApplied(
    current: Record<string, unknown>,
    changes: CustomerChanges,
  ): boolean {
    return Object.entries(changes).every(
      ([key, value]) => current[key] === value,
    );
  }

  private invalidArguments(tool: MutationAction) {
    return {
      tool,
      status: "error" as const,
      output: { code: "INVALID_ASSISTANT_TOOL_ARGUMENTS" },
    };
  }

  private outOfScope(tool: MutationAction) {
    return {
      tool,
      status: "error" as const,
      output: { code: "ASSISTANT_TARGET_OUT_OF_SCOPE" },
    };
  }

  private secret(): string | null {
    const value = process.env.AUTH_SESSION_SECRET;
    return value && !value.includes("placeholder") ? value : null;
  }

  private isSupportedTool(name: string): name is AssistantMutationToolName {
    return (
      name === "find_customers" ||
      name === "list_appointments" ||
      name === "update_customer" ||
      name === "reschedule_appointment"
    );
  }
}

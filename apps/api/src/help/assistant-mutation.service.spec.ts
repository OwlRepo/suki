import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMutationService } from "./assistant-mutation.service";

const customers = {
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

const appointments = {
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

const planCapacity = {
  isReadOnly: vi.fn(),
};

const auditLog = {
  log: vi.fn(),
};

function createService() {
  return new AssistantMutationService(
    customers as never,
    appointments as never,
    planCapacity as never,
    auditLog as never,
  );
}

describe("AssistantMutationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SESSION_SECRET", "test-assistant-confirmation-secret");
    planCapacity.isReadOnly.mockResolvedValue(false);
    auditLog.log.mockResolvedValue(undefined);
    customers.findById.mockResolvedValue({
      id: "customer-1",
      businessId: "business-1",
      name: "Ana",
      mobile: "+639171234567",
      email: "ana@example.com",
      notes: "Original",
      preferences: null,
      tags: "vip",
    });
    appointments.findById.mockResolvedValue({
      id: "appointment-1",
      businessId: "business-1",
      scheduledAt: new Date("2026-06-20T02:00:00.000Z"),
      notes: "Original",
      visitRecordedAt: null,
    });
  });

  it("exposes only bounded lookup and reversible mutation tools", () => {
    const names = createService()
      .getToolDefinitions()
      .map((tool) => ("name" in tool ? tool.name : null));

    expect(names).toEqual([
      "find_customers",
      "list_appointments",
      "update_customer",
      "reschedule_appointment",
    ]);
    expect(names.join(" ")).not.toMatch(
      /delete|remove|send|billing|payment|status|visit|arrive|complete/i,
    );
  });

  it("registers only confirmed writes for mutation rollout", () => {
    const names = createService()
      .getMutationToolDefinitions()
      .map((tool) => ("name" in tool ? tool.name : null));

    expect(names).toEqual(["update_customer", "reschedule_appointment"]);
  });

  it("returns a signed confirmation proposal without applying a mutation", async () => {
    const result = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });

    expect(result.status).toBe("confirmation_required");
    expect(result.confirmation?.token).toMatch(/\./);
    expect(result.confirmation?.summary).toContain("Ana Reyes");
    expect(customers.update).not.toHaveBeenCalled();
  });

  it("confirms an update only for the same authenticated tenant and user", async () => {
    customers.update.mockResolvedValue({
      id: "customer-1",
      name: "Ana Reyes",
    });
    const proposal = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });

    const result = await createService().confirm({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      token: proposal.confirmation!.token,
    });

    expect(customers.update).toHaveBeenCalledWith("customer-1", "org-1", {
      name: "Ana Reyes",
    });
    expect(auditLog.log).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorUserId: "user-1",
      action: "assistant_customer_update",
      entity: "customer",
      entityId: "customer-1",
      details: {
        alreadyApplied: false,
        changedFields: ["name"],
      },
    });
    expect(result).toEqual({
      status: "ok",
      action: "update_customer",
      result: { id: "customer-1", name: "Ana Reyes" },
    });
  });

  it("rejects confirmation replayed by another user", async () => {
    const proposal = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });

    await expect(
      createService().confirm({
        organizationId: "org-1",
        userId: "user-2",
        businessId: "business-1",
        token: proposal.confirmation!.token,
      }),
    ).rejects.toThrow("ASSISTANT_CONFIRMATION_SCOPE_MISMATCH");
    expect(customers.update).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it("rejects tampered confirmation tokens", async () => {
    const proposal = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });

    await expect(
      createService().confirm({
        organizationId: "org-1",
        userId: "user-1",
        businessId: "business-1",
        token: `${proposal.confirmation!.token}tampered`,
      }),
    ).rejects.toThrow("ASSISTANT_CONFIRMATION_INVALID");
  });

  it("rejects stale customer updates instead of overwriting newer data", async () => {
    const proposal = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });
    customers.findById.mockResolvedValueOnce({
      id: "customer-1",
      businessId: "business-1",
      name: "Changed by another user",
      mobile: "+639171234567",
      email: "ana@example.com",
      notes: "Original",
      preferences: null,
      tags: "vip",
    });

    await expect(
      createService().confirm({
        organizationId: "org-1",
        userId: "user-1",
        businessId: "business-1",
        token: proposal.confirmation!.token,
      }),
    ).rejects.toThrow("ASSISTANT_CONFIRMATION_STALE");
    expect(customers.update).not.toHaveBeenCalled();
  });

  it("blocks mutation proposals for read-only accounts", async () => {
    planCapacity.isReadOnly.mockResolvedValue(true);

    const result = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "update_customer",
      argumentsJson: JSON.stringify({
        customerId: "customer-1",
        name: "Ana Reyes",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
      }),
    });

    expect(result).toEqual({
      tool: "update_customer",
      status: "error",
      output: { code: "ACCOUNT_READ_ONLY" },
    });
  });

  it("reschedules only after confirmation and rejects cross-business targets", async () => {
    appointments.findById.mockResolvedValueOnce({
      id: "appointment-1",
      businessId: "business-2",
      scheduledAt: new Date("2026-06-20T02:00:00.000Z"),
      notes: "Original",
      visitRecordedAt: null,
    });

    const result = await createService().executeTool({
      organizationId: "org-1",
      userId: "user-1",
      businessId: "business-1",
      name: "reschedule_appointment",
      argumentsJson: JSON.stringify({
        appointmentId: "appointment-1",
        scheduledAt: "2026-06-21T02:00:00.000Z",
        notes: null,
      }),
    });

    expect(result).toEqual({
      tool: "reschedule_appointment",
      status: "error",
      output: { code: "ASSISTANT_TARGET_OUT_OF_SCOPE" },
    });
    expect(appointments.update).not.toHaveBeenCalled();
  });
});

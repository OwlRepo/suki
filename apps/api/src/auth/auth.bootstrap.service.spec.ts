import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.fn();

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>("@tyvera/database");
  return {
    ...actual,
    getDb: () => getDbMock(),
  };
});

import { AuthBootstrapService } from "./auth.bootstrap.service";

describe("AuthBootstrapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_BOOTSTRAP_DEFAULT_ACCOUNT;
    delete process.env.AUTH_BOOTSTRAP_EMAIL;
    delete process.env.AUTH_BOOTSTRAP_PASSWORD;
    delete process.env.AUTH_BOOTSTRAP_ORG_NAME;
    process.env.NODE_ENV = "development";
  });

  it("no-ops when bootstrap is disabled", async () => {
    const service = new AuthBootstrapService();
    await service.ensureDefaultAccount();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("no-ops when account already exists", async () => {
    process.env.AUTH_BOOTSTRAP_DEFAULT_ACCOUNT = "true";
    process.env.AUTH_BOOTSTRAP_EMAIL = "owner@test.com";
    process.env.AUTH_BOOTSTRAP_PASSWORD = "password123";

    const limit = vi.fn(async () => [{ id: "identity-1" }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    getDbMock.mockReturnValue({ select });

    const service = new AuthBootstrapService();
    await service.ensureDefaultAccount();

    expect(select).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("creates default account when enabled and missing", async () => {
    process.env.AUTH_BOOTSTRAP_DEFAULT_ACCOUNT = "true";
    process.env.AUTH_BOOTSTRAP_EMAIL = "owner@test.com";
    process.env.AUTH_BOOTSTRAP_PASSWORD = "password123";
    process.env.AUTH_BOOTSTRAP_ORG_NAME = "Bootstrap Org";

    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "row-1" }]),
        })),
      })),
    };
    const limit = vi.fn(async () => []);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const transaction = vi.fn(async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx));
    getDbMock.mockReturnValue({ select, transaction });

    const service = new AuthBootstrapService();
    await service.ensureDefaultAccount();

    expect(transaction).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });
});


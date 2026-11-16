import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportsPage from "./page";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: async () => "session" }) }));
vi.mock("@/hooks/use-auth-sync", () => ({ useAuthSync: () => ({ data: { organization: { id: "org1" } } }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ activeBusinessId: "biz1", businesses: [{ id: "biz1", name: "Salon" }], loading: false }) }));
vi.mock("@/lib/api", () => ({ apiRequest: async () => ({ batches: [] }) }));
vi.mock("@/components/ai-quota-banner", () => ({ AiQuotaBanner: () => null }));

describe("direct import inputs", () => {
  it("regression: shows CSV inputs immediately and switches to provider input without Continue", async () => {
    render(<ImportsPage />);
    expect(await screen.findByText("Choose CSV or Excel file")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue to csv/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "HubSpot" }));
    expect(screen.getByPlaceholderText("pat-na1-xxxx")).toBeInTheDocument();
    expect(screen.queryByText("Choose CSV or Excel file")).not.toBeInTheDocument();
  });
});

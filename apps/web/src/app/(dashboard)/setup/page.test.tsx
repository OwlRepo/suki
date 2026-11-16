import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SetupPage from "./page";

const mocks = vi.hoisted(() => ({ api: vi.fn(async () => ({})), push: vi.fn(), refetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: async () => "session" }) }));
vi.mock("@/hooks/use-auth-sync", () => ({ useAuthSync: () => ({ data: { organization: { id: "org1" } }, loading: false }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ refetch: mocks.refetch }) }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="Type of business" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

describe("direct business setup", () => {
  it("regression: creates the business from details without a mandatory recommendations screen", async () => {
    render(<SetupPage />);
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: "Suki Salon" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "salon" } });
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/businesses", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Suki Salon", businessType: "salon", workflowProfile: "service_scheduling" }) })));
    expect(mocks.refetch).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/onboarding");
  });
});

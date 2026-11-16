import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingSetupStep } from "./onboarding-setup-step";

const mock = vi.hoisted(() => ({
  token: vi.fn(async () => "session-token"),
  api: vi.fn(),
  refetch: vi.fn(async () => undefined),
  onComplete: vi.fn(),
  onBusinessCreated: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mock.token }) }));
vi.mock("@/lib/api", () => ({ apiRequest: (...args: unknown[]) => mock.api(...args) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ businesses: [], refetch: mock.refetch }) }));

describe("Onboarding business creation failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Radix Select scrolls focused options; jsdom has no scrolling implementation.
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    mock.api.mockRejectedValue(new Error("Business could not be saved"));
  });
  afterEach(() => Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"));

  it("error: retains entered business details and permits retry after POST failure", async () => {
    render(<OnboardingSetupStep onComplete={mock.onComplete} onBusinessCreated={mock.onBusinessCreated} />);
    fireEvent.change(screen.getByRole("textbox", { name: /business name/i }), { target: { value: "My Salon" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: /type of business/i }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Salon / Hair & Beauty" }));
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Business could not be saved");
    expect(screen.getByRole("textbox", { name: /business name/i })).toHaveValue("My Salon");
    expect(screen.getByRole("combobox", { name: /type of business/i })).toHaveTextContent("Salon / Hair & Beauty");
    expect(screen.getByRole("button", { name: "Create business" })).toBeEnabled();
    expect(mock.refetch).not.toHaveBeenCalled();
    expect(mock.onBusinessCreated).not.toHaveBeenCalled();
    expect(mock.onComplete).not.toHaveBeenCalled();
    expect(mock.api).toHaveBeenCalledWith("/businesses", expect.objectContaining({ method: "POST", token: "session-token", body: JSON.stringify({ name: "My Salon", businessType: "salon", workflowProfile: "service_scheduling" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));
    await waitFor(() => expect(mock.api).toHaveBeenCalledTimes(2));
  });
});

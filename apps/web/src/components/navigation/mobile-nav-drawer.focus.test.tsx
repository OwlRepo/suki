import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavDrawer } from "./mobile-nav-drawer";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/workspace-dropdown", () => ({ WorkspaceDropdown: () => <button>Workspace</button> }));

function MenuHarness() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>More navigation</button><MobileNavDrawer open={open} onOpenChange={setOpen} groups={[{ key: "daily", label: "Daily tasks", items: [{ href: "/appointments", label: "Appointments", icon: CalendarDays }] }]} /></>;
}

async function openMenu() {
  const opener = screen.getByRole("button", { name: "More navigation" });
  opener.focus();
  fireEvent.click(opener);
  return { opener, dialog: await screen.findByRole("dialog") };
}

describe("external mobile menu launcher", () => {
  it("edge: does not move focus back to the launcher after choosing a destination", async () => {
    render(<MenuHarness />);
    const { opener } = await openMenu();
    const destination = screen.getByRole("link", { name: "Appointments" });
    destination.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(destination);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).not.toHaveFocus();
  });

  it("regression: restores the actual external launcher after Escape", async () => {
    render(<MenuHarness />);
    const { opener, dialog } = await openMenu();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("regression: restores the actual external launcher after Close", async () => {
    render(<MenuHarness />);
    const { opener } = await openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

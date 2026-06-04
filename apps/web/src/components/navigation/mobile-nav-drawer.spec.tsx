import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavDrawer } from "./mobile-nav-drawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("MobileNavDrawer badges", () => {
  it("shows mobile drawer badge", () => {
    render(
      <MobileNavDrawer
        open
        onOpenChange={vi.fn()}
        groups={[
          {
            key: "daily",
            label: "Daily tasks",
            items: [
              {
                href: "/needs-attention",
                label: "Needs Attention",
                icon: AlertCircle,
                badgeCount: 3,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

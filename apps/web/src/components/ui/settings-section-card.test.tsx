import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsSectionCard } from "./settings-section-card";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("direct settings access", () => {
  it("edge: leaves unrelated sections collapsed", () => {
    window.history.replaceState(null, "", "/settings#messaging");
    render(<SettingsSectionCard id="automation" title="Automated follow-ups" description="Reminders" collapsedByDefault><p>Reminder controls</p></SettingsSectionCard>);
    expect(screen.getByRole("button", { name: /automated follow-ups/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("regression: opens a linked section without another expand click", () => {
    window.history.replaceState(null, "", "/settings#automation");
    render(<SettingsSectionCard id="automation" title="Automated follow-ups" description="Reminders" collapsedByDefault><p>Reminder controls</p></SettingsSectionCard>);
    expect(screen.getByRole("button", { name: /automated follow-ups/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region")).toBeVisible();
  });

  it("regression: opens an in-page destination when the hash changes", () => {
    render(<SettingsSectionCard id="automation" title="Automated follow-ups" description="Reminders" collapsedByDefault><p>Reminder controls</p></SettingsSectionCard>);
    act(() => {
      window.history.replaceState(null, "", "/settings#automation");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("button", { name: /automated follow-ups/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("regression: reopens the destination when its unchanged hash link is clicked", () => {
    window.history.replaceState(null, "", "/settings#automation");
    render(<><a href="#automation">Open automation</a><SettingsSectionCard id="automation" title="Automated follow-ups" description="Reminders" collapsedByDefault><p>Reminder controls</p></SettingsSectionCard></>);
    fireEvent.click(screen.getByRole("button", { name: /automated follow-ups/i }));
    fireEvent.click(screen.getByRole("link", { name: "Open automation" }));
    expect(screen.getByRole("button", { name: /automated follow-ups/i })).toHaveAttribute("aria-expanded", "true");
  });
});

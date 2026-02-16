"use client";

import Link from "next/link";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useAccountSummary } from "@/hooks/use-account-freshness";
import { isChecklistItemUnlocked } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

export function OnboardingChecklist() {
  const onboarding = useOnboarding();
  const { summary } = useAccountSummary();

  if (!onboarding || onboarding.onboardingCompletedAt) return null;
  if (onboarding.checklistDay > 7) return null;

  const items = onboarding.getChecklistForDay(onboarding.checklistDay);
  if (items.length === 0) return null;

  const counts = summary ?? {
    businesses: 0,
    customers: 0,
    appointments: 0,
    promos: 0,
  };

  return (
    <div
      className="mb-6 rounded-lg border border-border bg-card p-4"
      role="region"
      aria-label="First 7 days checklist"
    >
      <h2 className="text-base font-semibold text-foreground">
        Day {onboarding.checklistDay} – Your guide for today
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Do tasks in order. Each unlocks the next. Click a task to go there, then check it off when done.
      </p>
      <ul className="mt-3 space-y-2" role="list">
        {items.map((item, idx) => {
          const isDone = onboarding.isChecklistItemDone(onboarding.checklistDay, idx);
          const isUnlocked = isChecklistItemUnlocked(item, counts);
          const isLocked = !isUnlocked;

          const labelEl = (
            <span
              className={
                isDone
                  ? "text-muted-foreground line-through"
                  : isLocked
                    ? "text-muted-foreground"
                    : "text-foreground"
              }
            >
              {item.label}
            </span>
          );

          return (
            <li
              key={idx}
              className={`flex items-center gap-2 text-base ${isLocked ? "opacity-70" : ""}`}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isLocked) {
                    onboarding.completeChecklistItem(onboarding.checklistDay, idx);
                    recordOnboardingEvent("checklist_item_done", onboarding.organizationId, {
                      day: onboarding.checklistDay,
                    });
                  }
                }}
                disabled={isLocked}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-sm transition-colors hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                aria-pressed={isDone}
                aria-disabled={isLocked}
                aria-label={
                  isLocked
                    ? `Locked: ${item.lockedMessage ?? "Complete earlier tasks first"}`
                    : isDone
                      ? `Done: ${item.label}`
                      : `Mark done: ${item.label}`
                }
              >
                {isLocked ? (
                  <span className="text-muted-foreground" aria-hidden>
                    ⊘
                  </span>
                ) : isDone ? (
                  "✓"
                ) : (
                  "○"
                )}
              </button>
              {isLocked ? (
                <span
                  className="flex flex-1 flex-col gap-0.5"
                  title={item.lockedMessage}
                >
                  {labelEl}
                  <span className="text-xs text-muted-foreground">
                    {item.lockedMessage}
                  </span>
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="flex flex-1 items-center gap-1 rounded-md py-0.5 pr-2 transition-colors hover:bg-muted/50 hover:text-primary"
                >
                  {labelEl}
                  <span className="text-xs text-muted-foreground" aria-hidden>
                    →
                  </span>
                </Link>
              ) : (
                <span className="flex flex-1 items-center gap-2">{labelEl}</span>
              )}
            </li>
          );
        })}
      </ul>
      {onboarding.checklistDay < 7 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Complete today&apos;s list to build your daily habit. Come back
          tomorrow for Day {onboarding.checklistDay + 1}.
        </p>
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PREVIEW_ACTIONS = [
  {
    title: "Schedule your first appointment",
    description: "Add customer details while booking so the day starts from appointments.",
  },
  {
    title: "Mark arriving customers",
    description: "Tap Arrived once when a customer physically comes in.",
  },
  {
    title: "Let Tyvera record the visit",
    description: "Checked-in appointments complete automatically after the expected duration.",
  },
] as const;

export function OnboardingDashboardPreviewStep({
  onContinue,
  onContinueSecondary,
  disabled,
}: {
  onContinue: () => void;
  onContinueSecondary?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5">
        <h2 className="text-base font-medium text-foreground">Your dashboard will show these three actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with the first one, then move to the next. You can always come back.
        </p>
        <ul className="mt-4 space-y-4">
          {PREVIEW_ACTIONS.map((action, idx) => (
            <li
              key={idx}
              className={cn(
                "flex items-start gap-3 rounded-md border border-border bg-card p-4",
                idx === 0 && "border-primary/50 bg-primary/5"
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
                aria-hidden
              >
                {idx + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{action.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{action.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="min-h-[44px] text-base"
          onClick={onContinue}
          disabled={disabled}
        >
          I understand this screen
        </Button>
        {onContinueSecondary && (
          <Button
            variant="outline"
            size="lg"
            className="min-h-[44px] text-base"
            onClick={onContinueSecondary}
            disabled={disabled}
          >
            Show this again later
          </Button>
        )}
      </div>
    </div>
  );
}

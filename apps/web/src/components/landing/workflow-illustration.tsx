"use client";

/**
 * Workflow/dashboard-style digital art: automation in action.
 * Represents set-once, runs-automatically value.
 */
export function WorkflowIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="workflow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* Dashboard panel */}
      <rect
        x="40"
        y="40"
        width="400"
        height="240"
        rx="16"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Header bar */}
      <rect
        x="40"
        y="40"
        width="400"
        height="48"
        rx="16"
        fill="var(--muted)"
      />
      <rect x="40" y="74" width="400" height="14" rx="0" fill="transparent" />
      {/* Window dots */}
      <circle cx="68" cy="64" r="5" fill="var(--muted-foreground)" fillOpacity="0.3" />
      <circle cx="88" cy="64" r="5" fill="var(--muted-foreground)" fillOpacity="0.3" />
      <circle cx="108" cy="64" r="5" fill="var(--muted-foreground)" fillOpacity="0.3" />
      {/* Content blocks */}
      <rect x="64" y="110" width="120" height="72" rx="8" fill="var(--muted)" fillOpacity="0.8" />
      <rect x="64" y="125" width="80" height="8" rx="4" fill="var(--muted-foreground)" fillOpacity="0.2" />
      <rect x="64" y="145" width="100" height="8" rx="4" fill="var(--muted-foreground)" fillOpacity="0.15" />
      <rect x="64" y="165" width="60" height="8" rx="4" fill="var(--muted-foreground)" fillOpacity="0.2" />
      <rect
        x="200"
        y="110"
        width="140"
        height="72"
        rx="8"
        fill="var(--primary)"
        fillOpacity="0.08"
        stroke="var(--primary)"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
      <rect x="216" y="125" width="50" height="6" rx="3" fill="var(--primary)" fillOpacity="0.5" />
      <rect x="216" y="145" width="100" height="6" rx="3" fill="var(--muted-foreground)" fillOpacity="0.2" />
      <rect x="216" y="165" width="80" height="6" rx="3" fill="var(--muted-foreground)" fillOpacity="0.2" />
      <circle cx="300" cy="155" r="12" fill="var(--primary)" fillOpacity="0.2" />
      <path
        d="M295 155 l4 4 8 -8"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="360" y="110" width="72" height="72" rx="8" fill="var(--muted)" fillOpacity="0.8" />
      <circle cx="396" cy="145" r="14" fill="var(--primary)" fillOpacity="0.15" />
      <path
        d="M390 145 l4 5 8 -10"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Flow arrows */}
      <path
        d="M184 146 H198"
        stroke="var(--primary)"
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M340 146 H354"
        stroke="var(--primary)"
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Bottom stat row */}
      <rect x="64" y="200" width="100" height="48" rx="8" fill="var(--muted)" fillOpacity="0.6" />
      <rect x="176" y="200" width="100" height="48" rx="8" fill="var(--muted)" fillOpacity="0.6" />
      <rect x="288" y="200" width="100" height="48" rx="8" fill="var(--muted)" fillOpacity="0.6" />
      <rect x="400" y="200" width="32" height="48" rx="8" fill="var(--muted)" fillOpacity="0.6" />
    </svg>
  );
}

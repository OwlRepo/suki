"use client";

/**
 * High-resolution digital art for hero: automation + customer engagement theme.
 * Calendar, message bubbles, and connected flow—never breaks, scales infinitely.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="hero-grad-1"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient
          id="hero-grad-2"
          x1="0%"
          y1="100%"
          x2="0%"
          y2="0%"
        >
          <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Background soft shapes */}
      <ellipse cx="240" cy="200" rx="200" ry="180" fill="url(#hero-grad-1)" />
      {/* Calendar card */}
      <rect
        x="120"
        y="80"
        width="140"
        height="120"
        rx="12"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <rect
        x="120"
        y="80"
        width="140"
        height="32"
        rx="12"
        fill="var(--primary)" fillOpacity="0.2"
      />
      <rect x="120" y="112" width="140" height="88" rx="0" fill="transparent" />
      <line
        x1="140"
        y1="140"
        x2="200"
        y2="140"
        stroke="var(--muted-foreground)"
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <line
        x1="220"
        y1="140"
        x2="250"
        y2="140"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <rect x="140" y="165" width="24" height="18" rx="4" fill="var(--primary)" fillOpacity="0.15" />
      <rect x="175" y="165" width="24" height="18" rx="4" fill="var(--muted)" />
      <rect x="210" y="165" width="24" height="18" rx="4" fill="var(--muted)" />
      {/* Message bubbles */}
      <rect
        x="280"
        y="100"
        width="100"
        height="50"
        rx="12"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path
        d="M285 145 l10 8 -10 0 z"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="320"
        y="180"
        width="110"
        height="45"
        rx="12"
        fill="var(--primary)" fillOpacity="0.15"
        stroke="var(--primary)" strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <path
        d="M335 225 l-10 8 10 0 z"
        fill="var(--primary)" fillOpacity="0.15"
        stroke="var(--primary)" strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Checkmark flow */}
      <circle cx="200" cy="280" r="24" fill="var(--primary)" fillOpacity="0.2" />
      <path
        d="M192 280 l6 6 12 -14"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="280" cy="280" r="24" fill="var(--primary)" fillOpacity="0.2" />
      <path
        d="M272 280 l6 6 12 -14"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M224 280 H256"
        stroke="var(--muted-foreground)"
        strokeOpacity="0.3"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {/* People/contacts icon */}
      <circle cx="360" cy="120" r="28" fill="url(#hero-grad-2)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="352" cy="112" r="6" fill="var(--muted-foreground)" fillOpacity="0.6" />
      <circle cx="372" cy="108" r="5" fill="var(--muted-foreground)" fillOpacity="0.5" />
      <circle cx="366" cy="128" r="5" fill="var(--muted-foreground)" fillOpacity="0.5" />
    </svg>
  );
}

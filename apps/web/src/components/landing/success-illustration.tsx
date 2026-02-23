"use client";

/**
 * Success/growth digital art for final CTA: upward trajectory, completion.
 */
export function SuccessIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="success-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Background */}
      <ellipse cx="240" cy="220" rx="220" ry="160" fill="url(#success-grad)" />
      {/* Rising chart */}
      <path
        d="M80 320 L120 280 L160 260 L200 200 L240 180 L280 140 L320 100 L360 80 L400 60"
        stroke="var(--primary)"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M80 320 L120 280 L160 260 L200 200 L240 180 L280 140 L320 100 L360 80 L400 60 L400 320 L80 320 Z"
        fill="var(--primary)"
        fillOpacity="0.06"
      />
      <circle cx="400" cy="60" r="12" fill="var(--primary)" />
      <circle cx="400" cy="60" r="6" fill="var(--primary-foreground)" />
      {/* Large checkmark */}
      <circle cx="240" cy="180" r="56" fill="var(--primary)" fillOpacity="0.15" />
      <path
        d="M210 180 l20 22 44 -48"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Supporting checkmarks */}
      <circle cx="120" cy="260" r="20" fill="var(--primary)" fillOpacity="0.1" />
      <path
        d="M112 260 l5 6 10 -12"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="360" cy="100" r="20" fill="var(--primary)" fillOpacity="0.1" />
      <path
        d="M352 100 l5 6 10 -12"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Decorative dots */}
      <circle cx="100" cy="120" r="4" fill="var(--muted-foreground)" fillOpacity="0.15" />
      <circle cx="380" cy="200" r="4" fill="var(--muted-foreground)" fillOpacity="0.15" />
      <circle cx="340" cy="280" r="4" fill="var(--muted-foreground)" fillOpacity="0.1" />
    </svg>
  );
}

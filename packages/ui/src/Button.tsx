import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

const variants = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  outline:
    "border-2 border-zinc-300 bg-transparent hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-800",
  ghost:
    "bg-transparent hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-800",
};

const sizes = {
  sm: "min-h-[36px] px-3 text-sm",
  md: "min-h-[44px] px-4 text-base",
  lg: "min-h-[52px] px-6 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors touch-manipulation",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

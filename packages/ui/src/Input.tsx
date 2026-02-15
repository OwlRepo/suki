import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "min-h-[44px] rounded-lg border px-4 text-base transition-colors touch-manipulation",
          "border-zinc-300 bg-white focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/30",
          "dark:border-zinc-600 dark:bg-zinc-800 dark:focus:border-zinc-400",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

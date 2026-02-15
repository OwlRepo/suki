import * as React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

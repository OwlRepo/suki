"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageSectionProps {
  children: React.ReactNode;
  /** Optional section title */
  title?: React.ReactNode;
  /** Optional description below title */
  description?: React.ReactNode;
  className?: string;
}

/**
 * Consistent section wrapper for page content.
 * Provides vertical rhythm and optional title/description.
 */
export function PageSection({ children, title, description, className }: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-base font-medium text-foreground">{title}</h2>
          )}
          {description && (
            <p className="text-helper">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton block with animate-pulse.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
    />
  );
}

/**
 * Skeleton for metric card in dashboard grids.
 * Matches MetricCard layout: label, value, optional suffix.
 */
export function MetricCardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 min-w-0 flex flex-col",
        className
      )}
      aria-hidden
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-full max-w-[180px]" />
    </div>
  );
}

/**
 * Grid of metric card skeletons. Default 3 columns.
 */
export function MetricGridSkeleton({
  count = 3,
  className,
}: SkeletonProps & { count?: number }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Single list row skeleton (name, meta text, optional badge).
 */
export function ListRowSkeleton({ className }: SkeletonProps) {
  return (
    <li
      className={cn("flex items-center justify-between py-5 first:pt-0", className)}
      aria-hidden
    >
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-16 shrink-0" />
    </li>
  );
}

/**
 * List section with multiple row skeletons.
 */
export function ListSkeleton({
  rowCount = 5,
  className,
}: SkeletonProps & { rowCount?: number }) {
  return (
    <ul className={cn("divide-y divide-border", className)} aria-hidden>
      {Array.from({ length: rowCount }, (_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </ul>
  );
}

/**
 * Settings section skeleton - card with placeholder content.
 */
export function SettingsSectionSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 space-y-3",
        className
      )}
      aria-hidden
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-64" />
      <Skeleton className="h-12 w-full max-w-md" />
    </div>
  );
}

/**
 * Pipeline column skeleton (header + cards).
 */
export function PipelineColumnSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "w-64 shrink-0 rounded-lg border border-border bg-card p-4",
        className
      )}
      aria-hidden
    >
      <Skeleton className="h-4 w-20" />
      <div className="mt-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

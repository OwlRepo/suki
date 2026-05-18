"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildMonthCells(month: string): string[] {
  const [year, monthNum] = month.split("-").map(Number);
  const first = new Date(year, monthNum - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

export function AvailabilityCalendar({
  month,
  selectedDay,
  availableDays,
  onSelect,
}: {
  month: string;
  selectedDay: string | null;
  availableDays: string[];
  onSelect: (day: string) => void;
}) {
  const cells = buildMonthCells(month);
  const availableSet = new Set(availableDays);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const inMonth = day.startsWith(month);
          const isAvailable = inMonth && availableSet.has(day);
          const isSelected = selectedDay === day;
          const date = new Date(day);
          return (
            <Button
              key={day}
              type="button"
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "h-11 w-full justify-center rounded-xl px-0 text-base sm:h-10 sm:text-sm",
                !inMonth && "opacity-40",
                !isAvailable && "border-dashed bg-muted/20 text-muted-foreground",
              )}
              disabled={!isAvailable}
              onClick={() => onSelect(day)}
              aria-label={`${date.toLocaleDateString()} ${isAvailable ? "available" : "unavailable"}`}
            >
              {date.getDate()}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function parseMonthValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function formatDateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthGridBase(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

type DayCalendarProps = {
  monthAnchor: Date;
  selected?: Date | null;
  onSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
};

function DayCalendar({ monthAnchor, selected, onSelect, onMonthChange }: DayCalendarProps) {
  const cells = useMemo(() => monthGridBase(monthAnchor), [monthAnchor]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onMonthChange(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium">{monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onMonthChange(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const inMonth = cell.getMonth() === monthAnchor.getMonth();
          const isSelected = selected && toDateOnly(selected).getTime() === toDateOnly(cell).getTime();
          return (
            <Button
              key={cell.toISOString()}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "ghost"}
              className={cn("h-8 px-0", !inMonth && "text-muted-foreground")}
              onClick={() => onSelect(cell)}
            >
              {cell.getDate()}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const selected = parseDateValue(value);
  const [anchor, setAnchor] = useState<Date>(selected ?? new Date());
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-start font-normal" aria-label={ariaLabel}>
          <CalendarIcon className="mr-2 size-4" />
          {selected ? selected.toLocaleDateString() : placeholder ?? "Pick date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <DayCalendar
          monthAnchor={anchor}
          selected={selected}
          onMonthChange={setAnchor}
          onSelect={(date) => {
            onChange(formatDateValue(date));
            setAnchor(date);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function MonthPicker({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const selected = parseMonthValue(value);
  const [yearAnchor, setYearAnchor] = useState<number>((selected ?? new Date()).getFullYear());
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-start font-normal", className)}>
          <CalendarIcon className="mr-2 size-4" />
          {selected ? selected.toLocaleDateString([], { month: "long", year: "numeric" }) : placeholder ?? "Pick month"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" size="sm" variant="outline" onClick={() => setYearAnchor((v) => v - 1)} aria-label="Previous year">
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-medium">{yearAnchor}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setYearAnchor((v) => v + 1)} aria-label="Next year">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {monthNames.map((name, index) => {
            const isSelected = selected && selected.getFullYear() === yearAnchor && selected.getMonth() === index;
            return (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => onChange(formatMonthValue(new Date(yearAnchor, index, 1)))}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function roundToHalfHour(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = date.getMinutes() >= 30 ? "30" : "00";
  return `${h}:${m}`;
}

function splitDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date, timeRaw] = value.split("T");
  return { date: date || "", time: timeRaw ? timeRaw.slice(0, 5) : "" };
}

function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function DateTimePicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
}) {
  const parts = splitDateTime(value);
  const selectedDate = parseDateValue(parts.date);
  const [anchor, setAnchor] = useState<Date>(selectedDate ?? new Date());
  const display = value ? new Date(value).toLocaleString() : "Pick date and time";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-start font-normal" aria-label={ariaLabel}>
          <CalendarIcon className="mr-2 size-4" />
          {display}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 p-3" align="start">
        <DayCalendar
          monthAnchor={anchor}
          selected={selectedDate}
          onMonthChange={setAnchor}
          onSelect={(d) => {
            const nextDate = formatDateValue(d);
            onChange(joinDateTime(nextDate, parts.time || roundToHalfHour(new Date())));
            setAnchor(d);
          }}
        />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="datetime-picker-time">Time</label>
          <input
            id="datetime-picker-time"
            aria-label="Select time"
            className="border-input h-11 w-full rounded-md border bg-background px-3 text-sm"
            type="time"
            value={parts.time}
            onChange={(e) => onChange(joinDateTime(parts.date, e.target.value))}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

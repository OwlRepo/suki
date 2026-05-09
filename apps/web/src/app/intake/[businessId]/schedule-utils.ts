export function filterDayKeysByMonth(dayKeys: string[], month: string): string[] {
  return dayKeys.filter((day) => day.startsWith(`${month}-`));
}

export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const safeDate = new Date(year, month - 1, date);
  return safeDate.toLocaleDateString([], { month: "short", day: "numeric" });
}

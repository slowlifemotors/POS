// app/timesheet/components/formatHours.ts

// Converts decimal hours → "Xh Ym"
export function formatHours(decimal: number | null): string {
  if (!decimal || isNaN(decimal)) return "0h 0m";

  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);

  return `${hours}h ${minutes}m`;
}

// Converts timestamps into readable HH:MM format
export function formatTime(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Converts timestamp into “DD/MM/YYYY”
export function formatDate(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-AU");
}

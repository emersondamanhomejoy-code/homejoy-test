import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusStyles: Record<string, string> = {
  // Room / general statuses
  Available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Occupied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Available Soon": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  Archived: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",

  // Booking / Move-in review statuses
  "Pending Review": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Cancelled: "bg-muted text-muted-foreground",

  // New workflow statuses
  Submitted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "Ready for Move-in": "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  Reversed: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",

  // Payout / Earnings statuses
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Generated: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",

  // Adjusted (claims legacy)
  adjusted: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",

  // Frozen
  Frozen: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",

  // Active tenant
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ended: "bg-muted text-muted-foreground",
};

// Build a lowercase lookup for case-insensitive matching
const normalizedStyles: Record<string, string> = {};
for (const [key, value] of Object.entries(statusStyles)) {
  normalizedStyles[key] = value;
  normalizedStyles[key.toLowerCase()] = value;
}

const fallback = "bg-muted text-muted-foreground";

function formatShortDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy");
  } catch {
    return dateStr;
  }
}

export function StatusBadge({ status, availableDate, className }: { status: string; availableDate?: string; className?: string }) {
  const label =
    status === "Available Soon" && availableDate && availableDate !== "Available Now"
      ? `Available on ${formatShortDate(availableDate)}`
      : status;

  // Normalize: try exact match first, then lowercase
  const style = normalizedStyles[status] || normalizedStyles[status.toLowerCase()] || fallback;

  return (
    <Badge variant="secondary" className={cn("font-medium border-0 whitespace-nowrap", style, className)}>
      {label}
    </Badge>
  );
}

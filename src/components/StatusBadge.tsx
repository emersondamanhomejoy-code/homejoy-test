import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusStyles: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Occupied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Available Soon": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "Pending Review": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Cancelled: "bg-muted text-muted-foreground",
  Archived: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  adjusted: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

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

  return (
    <Badge variant="secondary" className={cn("font-medium border-0 whitespace-nowrap", statusStyles[status] || fallback, className)}>
      {label}
    </Badge>
  );
}

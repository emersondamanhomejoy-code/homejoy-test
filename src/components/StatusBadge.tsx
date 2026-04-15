import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusStyles: Record<string, string> = {
  // Room statuses
  Available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Occupied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Available Soon": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  Archived: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",

  // Order Status labels
  "Booking Submitted": "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "Booking Rejected": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "Booking Approved": "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "Booking Cancelled": "bg-muted text-muted-foreground",
  "Move-in Submitted": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Move-in Rejected": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "Move-in Approved": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",

  // snake_case order status values (for direct usage)
  booking_submitted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  booking_rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  booking_approved: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  booking_cancelled: "bg-muted text-muted-foreground",
  move_in_submitted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  move_in_rejected: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  move_in_approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",

  // Legacy statuses (keep for backward compat)
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Cancelled: "bg-muted text-muted-foreground",
  Submitted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "Pending Review": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Ready for Move-in": "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  ready_for_move_in: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  Reversed: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  reversed: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Closed: "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",

  // Payout / Earnings
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Generated: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
  Draft: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  adjusted: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Frozen: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ended: "bg-muted text-muted-foreground",
};

const normalizedStyles: Record<string, string> = {};
for (const [key, value] of Object.entries(statusStyles)) {
  normalizedStyles[key] = value;
  normalizedStyles[key.toLowerCase()] = value;
}

const ORDER_STATUS_DISPLAY: Record<string, string> = {
  booking_submitted: "Booking Submitted",
  booking_rejected: "Booking Rejected",
  booking_approved: "Booking Approved",
  booking_cancelled: "Booking Cancelled",
  move_in_submitted: "Move-in Submitted",
  move_in_rejected: "Move-in Rejected",
  move_in_approved: "Move-in Approved",
};

const fallback = "bg-muted text-muted-foreground";

function formatShortDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM");
  } catch {
    return dateStr;
  }
}

export function StatusBadge({ status, availableDate, className }: { status: string; availableDate?: string; className?: string }) {
  // Convert snake_case order statuses to display labels
  const isAvailableSoonWithDate = status === "Available Soon" && availableDate && availableDate !== "Available Now";
  const displayLabel = ORDER_STATUS_DISPLAY[status]
    || (isAvailableSoonWithDate
      ? null
      : status === "ready_for_move_in" ? "Ready for Move-in"
      : status === "closed" ? "Closed"
      : status === "reversed" ? "Reversed"
      : status);

  const style = normalizedStyles[status] || normalizedStyles[status.toLowerCase()] || fallback;

  return (
    <Badge variant="secondary" className={cn("font-medium border-0", isAvailableSoonWithDate ? "inline-flex flex-col items-center py-1 leading-tight" : "whitespace-nowrap", style, className)}>
      {isAvailableSoonWithDate ? (
        <>
          <span>Available</span>
          <span>{formatShortDate(availableDate!)}</span>
        </>
      ) : (displayLabel || status)}
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Occupied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Available Soon": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

const fallback = "bg-muted text-muted-foreground";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium border-0", statusStyles[status] || fallback, className)}>
      {status}
    </Badge>
  );
}

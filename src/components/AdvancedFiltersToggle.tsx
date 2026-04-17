import { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdvancedFiltersToggleProps {
  open: boolean;
  onToggle: () => void;
  activeCount?: number;
  className?: string;
}

export function AdvancedFiltersToggle({
  open,
  onToggle,
  activeCount = 0,
  className,
}: AdvancedFiltersToggleProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className={`gap-1.5 ${className ?? ""}`}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {open ? "Hide" : "Show"} Advanced Filters
      {activeCount > 0 && (
        <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}

interface AdvancedFiltersPanelProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function AdvancedFiltersPanel({
  open,
  children,
  className,
}: AdvancedFiltersPanelProps) {
  if (!open) return null;
  return (
    <div
      className={`mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-3 w-full ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

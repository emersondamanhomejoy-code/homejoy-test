import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/lib/ui-constants";

interface StandardFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function StandardFilterBar({
  search,
  onSearchChange,
  placeholder = "Search...",
  children,
  hasActiveFilters,
  onClearFilters,
}: StandardFilterBarProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${inputClass} w-full pl-10`}
          />
        </div>
        {hasActiveFilters && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      )}
    </div>
  );
}

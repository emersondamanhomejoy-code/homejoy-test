import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({ children, sortKey, currentSort, onSort, className }: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {isActive ? (
          currentSort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

export function useTableSort(defaultKey: string, defaultDirection: SortDirection = "asc") {
  const [sort, setSort] = useState<SortConfig>({ key: defaultKey, direction: defaultDirection });

  const handleSort = (key: string) => {
    setSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" as const };
        if (prev.direction === "desc") return { key: defaultKey, direction: defaultDirection };
        return { key, direction: "asc" as const };
      }
      return { key, direction: "asc" as const };
    });
  };

  const sortData = <T,>(data: T[], accessor: (item: T, key: string) => any): T[] => {
    if (!sort.direction) return data;
    return [...data].sort((a, b) => {
      const aVal = accessor(a, sort.key);
      const bVal = accessor(b, sort.key);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sort.direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  return { sort, handleSort, sortData };
}

import { useState } from "react";

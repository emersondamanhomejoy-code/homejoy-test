import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface StandardTableProps {
  columns: ReactNode;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  /** Total number of filtered items */
  total?: number;
  /** Current page (0-based) */
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Show count in header */
  showCount?: boolean;
  countLabel?: string;
  isLoading?: boolean;
}

export function StandardTable({
  columns,
  children,
  emptyMessage = "No data found",
  isEmpty = false,
  total = 0,
  page = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  showCount = false,
  countLabel = "item(s)",
  isLoading = false,
}: StandardTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPagination = onPageChange && total > 0;

  if (isLoading) {
    return (
      <div className="text-center py-10 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {showCount && (
        <div className="px-6 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">
            {total} {countLabel}
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>{columns}</TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow>
                <TableCell
                  colSpan={100}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              children
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            {onPageSizeChange && (
              <Select
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            )}
            <span>of {total}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

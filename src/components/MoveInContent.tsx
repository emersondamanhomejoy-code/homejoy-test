import { useState, useMemo } from "react";
import { useBookings, Booking } from "@/hooks/useBookings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MoveInContent() {
  const { data: bookings = [], isLoading } = useBookings();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("approved");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Show approved bookings with upcoming move-in dates
  const moveIns = useMemo(() => {
    let list = bookings;
    if (statusFilter !== "all") {
      list = list.filter(b => b.status === statusFilter);
    }
    // Sort by move-in date ascending
    list = [...list].sort((a, b) => new Date(a.move_in_date).getTime() - new Date(b.move_in_date).getTime());
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b =>
        b.tenant_name.toLowerCase().includes(s) ||
        (b.room?.building || "").toLowerCase().includes(s) ||
        (b.room?.unit || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [bookings, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(moveIns.length / pageSize));
  const paged = moveIns.slice((page - 1) * pageSize, page * pageSize);

  const isUpcoming = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d >= now;
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tenant or property..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{moveIns.length} move-ins</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Move-in Date</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No move-ins found
                </TableCell>
              </TableRow>
            ) : (
              paged.map(b => (
                <TableRow key={b.id} className={isUpcoming(b.move_in_date) ? "" : "opacity-60"}>
                  <TableCell className="text-sm font-medium">{b.tenant_name}</TableCell>
                  <TableCell className="text-sm">{b.room?.building || "—"}</TableCell>
                  <TableCell className="text-sm">{b.room ? `${b.room.unit} · ${b.room.room}` : "—"}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {b.move_in_date}
                    {isUpcoming(b.move_in_date) && (
                      <span className="ml-2 text-xs text-primary font-normal">Upcoming</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{b.contract_months}m</TableCell>
                  <TableCell className="text-sm">{b.pax_staying}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

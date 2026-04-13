import { useState, useMemo } from "react";
import { useBookings, Booking } from "@/hooks/useBookings";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";

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
    <StandardPageLayout title="Move-ins" count={moveIns.length}>
      <StandardFilterBar search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tenant or property...">
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
      </StandardFilterBar>

      {/* Table */}
      <StandardTable
        columns={
          <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Move-in Date</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
        }
        isEmpty={paged.length === 0}
        emptyMessage="No move-ins found"
        total={moveIns.length}
        page={page - 1}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p + 1)}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      >
        {paged.map(b => (
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
              ))}
      </StandardTable>
    </StandardPageLayout>
  );
}

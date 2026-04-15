import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";
import { useBookings, useUpdateOrderStatus, Booking, ORDER_STATUS_LABELS } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";

interface AgentBookingsContentProps {
  onEditBooking?: (booking: Booking) => void;
}

export function AgentBookingsContent({ onEditBooking }: AgentBookingsContentProps) {
  const { user } = useAuth();
  const { data: allBookings = [], isLoading } = useBookings();
  const updateBookingStatus = useUpdateOrderStatus();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const cancelValidation = useFormValidation();

  // Only show bookings submitted by this agent
  const myBookings = useMemo(() => {
    return allBookings.filter(b => b.submitted_by === user?.id);
  }, [allBookings, user?.id]);

  const filtered = useMemo(() => {
    let list = myBookings;
    if (statusFilter && statusFilter !== "all") {
      list = list.filter(b => b.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b =>
        b.tenant_name.toLowerCase().includes(s) ||
        b.id.toLowerCase().includes(s) ||
        (b.room?.building || "").toLowerCase().includes(s)
      );
    }
    return sortData(list, (b: Booking, key: string) => {
      const map: Record<string, any> = {
        id: b.id,
        building: b.room?.building || "",
        room: b.room ? `${b.room.unit} · ${b.room.room}` : "",
        tenant_name: b.tenant_name,
        created_at: b.created_at,
        status: b.status,
      };
      return map[key];
    });
  }, [myBookings, statusFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const statusBadge = (status: string) => {
    const cls = status === "submitted"
      ? "bg-yellow-500/20 text-yellow-600"
      : status === "approved"
        ? "bg-green-500/20 text-green-600"
        : status === "cancelled"
          ? "bg-gray-500/20 text-gray-500"
          : "bg-red-500/20 text-red-600";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status.toUpperCase()}</span>;
  };

  // Detail view
  if (selectedBooking) {
    const b = selectedBooking;
    const canCancel = b.status === "submitted" || b.status === "rejected";
    const canReEdit = b.status === "rejected";

    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedBooking(null); setCancelReason(""); }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to My Bookings
        </button>
        <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">{b.tenant_name}</div>
            {statusBadge(b.status)}
          </div>
          {b.room && <div className="text-sm text-muted-foreground">{b.room.building} · {b.room.unit} · {b.room.room}</div>}
          <div className="text-xs text-muted-foreground">Booking ID: {b.id.slice(0, 8)}... · Submitted: {format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tenant Info</div>
              <div className="text-sm space-y-1">
                <div>📞 {b.tenant_phone}</div>
                <div>✉️ {b.tenant_email || "—"}</div>
                <div>🪪 {b.tenant_ic_passport || "—"}</div>
                <div>👤 {b.tenant_gender || "—"} · {b.tenant_race || "—"} · {b.tenant_nationality || "—"}</div>
                <div>📅 Move-in: {b.move_in_date}</div>
                <div>📝 Contract: {b.contract_months} months</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Work & Details</div>
              <div className="text-sm space-y-1">
                <div>💼 {b.occupation || b.company || "—"}</div>
                <div>💰 RM{b.monthly_salary || "—"}/month</div>
                <div>👥 Pax: {b.pax_staying || "—"}</div>
                <div>🪪 Access Cards: {b.access_card_count || 0}</div>
                <div>🅿️ Parking: {b.parking || "0"} {b.car_plate ? `(${b.car_plate})` : ""}</div>
              </div>
            </div>
          </div>

          {/* Reject reason display */}
          {b.status === "rejected" && b.reject_reason && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
            </div>
          )}

          {/* Cancel reason display */}
          {b.status === "cancelled" && b.reject_reason && (
            <div className="bg-gray-500/10 text-gray-600 rounded-lg p-3 text-sm">
              <span className="font-semibold">Cancel Reason:</span> {b.reject_reason}
            </div>
          )}

          {/* Actions for pending / rejected */}
          {canCancel && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              {/* Re-edit for rejected bookings */}
              {canReEdit && onEditBooking && (
                <Button
                  onClick={() => onEditBooking(b)}
                  className="bg-primary hover:bg-primary/90"
                >
                  ✏️ Edit & Resubmit
                </Button>
              )}

              {/* Cancel booking */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700">
                ⚠️ Booking fee is <strong>non-refundable</strong> once paid. Please confirm with the tenant before cancelling.
              </div>
              <div className="flex gap-2">
                <div data-field="cancelReason">
                  <Input
                    placeholder="Cancel reason (required)..."
                    value={cancelReason}
                    onChange={e => { setCancelReason(e.target.value); cancelValidation.clearError("cancelReason"); }}
                    className={fieldClass("flex-1", !!cancelValidation.errors.cancelReason)}
                  />
                  <FieldError error={cancelValidation.errors.cancelReason} />
                </div>
                <Button
                  onClick={async () => {
                    const rules = { cancelReason: () => !cancelReason.trim() ? "Please enter a cancel reason" : null };
                    if (!cancelValidation.validate({ cancelReason }, rules)) return;
                    if (!user) return;
                    await updateBookingStatus.mutateAsync({
                      id: b.id,
                      status: "cancelled" as any,
                      reviewed_by: user.id,
                      reject_reason: cancelReason,
                    });
                    setSelectedBooking(null);
                    setCancelReason("");
                  }}
                  disabled={updateBookingStatus.isPending}
                  variant="outline"
                  className="text-gray-500 border-gray-300 hover:bg-gray-100"
                >
                  🚫 Cancel Booking
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold">My Bookings</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search name, ID, condo..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading bookings...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Booking ID</SortableTableHead>
                <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Condo</SortableTableHead>
                <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
                <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
                    <TableCell>{b.room?.building || "—"}</TableCell>
                    <TableCell>{b.room ? `${b.room.unit} · ${b.room.room}` : "—"}</TableCell>
                    <TableCell className="font-medium">{b.tenant_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(b)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {b.status === "rejected" && onEditBooking && (
                          <Button variant="ghost" size="icon" onClick={() => onEditBooking(b)} title="Edit & Resubmit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

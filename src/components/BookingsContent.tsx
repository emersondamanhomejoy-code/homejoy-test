import { useState, useMemo, useEffect } from "react";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export function BookingsContent() {
  const { user } = useAuth();
  const { data: allBookings = [], isLoading } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Fetch users for agent name display
  const [users, setUsers] = useState<UserInfo[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map(p => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
  }, []);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "—";
    const u = users.find(u => u.id === agentId);
    return u?.name || u?.email || agentId.slice(0, 8);
  };

  const filtered = useMemo(() => {
    let list = allBookings;
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
    return list;
  }, [allBookings, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const statusBadge = (status: string) => {
    const cls = status === "pending"
      ? "bg-yellow-500/20 text-yellow-600"
      : status === "approved"
        ? "bg-green-500/20 text-green-600"
        : status === "cancelled"
          ? "bg-gray-500/20 text-gray-500"
          : "bg-red-500/20 text-red-600";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status.toUpperCase()}</span>;
  };

  // Booking detail view
  if (selectedBooking) {
    const b = selectedBooking;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedBooking(null)} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Bookings
        </button>
        <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">{b.tenant_name}</div>
            {statusBadge(b.status)}
          </div>
          {b.room && <div className="text-sm text-muted-foreground">{b.room.building} · {b.room.unit} · {b.room.room}</div>}
          <div className="text-xs text-muted-foreground">Booking ID: {b.id.slice(0, 8)}... · Submitted by: {getAgentName(b.submitted_by)}</div>

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
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Emergency Contact 1</div>
              <div className="text-sm space-y-1">
                <div>👤 {b.emergency_name || "—"}</div>
                <div>📞 {b.emergency_phone || "—"}</div>
                <div>🔗 {b.emergency_relationship || "—"}</div>
              </div>
            </div>
          </div>

          {(b.status === "pending" || b.status === "approved") && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              {b.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      await updateBookingStatus.mutateAsync({
                        id: b.id, status: "approved", reviewed_by: user.id,
                        room_id: b.room_id, tenant_name: b.tenant_name,
                        tenant_gender: b.tenant_gender, tenant_race: b.tenant_race,
                        pax_staying: b.pax_staying,
                      });
                      setSelectedBooking(null);
                    }}
                    disabled={updateBookingStatus.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >✅ Approve</Button>
                </div>
              )}
              {b.status === "pending" && (
                <div className="flex gap-2">
                  <Input placeholder="Reject reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="flex-1" />
                  <Button
                    onClick={async () => {
                      if (!user || !rejectReason.trim()) { alert("Please enter a reject reason"); return; }
                      await updateBookingStatus.mutateAsync({ id: b.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason });
                      setSelectedBooking(null);
                      setRejectReason("");
                    }}
                    disabled={updateBookingStatus.isPending}
                    variant="destructive"
                  >❌ Reject</Button>
                </div>
              )}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700">
                ⚠️ Booking fee is <strong>non-refundable</strong> once paid. Please confirm with the tenant before cancelling.
              </div>
              <div className="flex gap-2">
                <Input placeholder="Cancel reason (required)..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="flex-1" />
                <Button
                  onClick={async () => {
                    if (!user || !cancelReason.trim()) { alert("Please enter a cancel reason"); return; }
                    if (!confirm("Are you sure you want to cancel this booking? Booking fee is non-refundable.")) return;
                    await updateBookingStatus.mutateAsync({ id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: cancelReason });
                    setSelectedBooking(null);
                    setCancelReason("");
                  }}
                  disabled={updateBookingStatus.isPending}
                  variant="outline"
                  className="text-gray-500 border-gray-300 hover:bg-gray-100"
                >🚫 Cancel</Button>
              </div>
            </div>
          )}

          {b.status === "rejected" && b.reject_reason && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
            </div>
          )}
          {b.status === "cancelled" && b.reject_reason && (
            <div className="bg-gray-500/10 text-gray-600 rounded-lg p-3 text-sm">
              <span className="font-semibold">Cancel Reason:</span> {b.reject_reason}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Bookings</h2>
        {/* Create booking button placeholder — full form TBD */}
        {/* <Button><Plus className="h-4 w-4 mr-1" /> Create Booking</Button> */}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
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
                <TableHead>Booking ID</TableHead>
                <TableHead>Condo</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
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
                    <TableCell className="font-medium">{b.tenant_name}</TableCell>
                    <TableCell className="text-sm">{getAgentName(b.submitted_by)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(b)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(b)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete"
                          onClick={async () => {
                            if (!confirm("Delete this booking?")) return;
                            await supabase.from("bookings").delete().eq("id", b.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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

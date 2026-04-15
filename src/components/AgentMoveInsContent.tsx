import { useState, useMemo } from "react";
import { useBookings, Booking, useUpdateOrderStatus, ORDER_STATUS_LABELS, OrderStatus } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Eye, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

const MOVE_IN_STATUSES: OrderStatus[] = [
  "booking_approved",
  "move_in_submitted",
  "move_in_rejected",
  "move_in_approved",
];

export function AgentMoveInsContent() {
  const { user } = useAuth();
  const { data: allBookings = [] } = useBookings();
  const updateOrderStatus = useUpdateOrderStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [viewItem, setViewItem] = useState<Booking | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    booking_id: "",
    agreement_signed: false,
    payment_method: "",
    receipt_path: "",
  });

  // My bookings at move-in stages
  const myBookings = useMemo(() =>
    allBookings.filter(b => b.submitted_by === user?.id && MOVE_IN_STATUSES.includes(b.order_status)),
    [allBookings, user?.id]
  );

  // Bookings ready for move-in submission (approved, not yet submitted)
  const pendingMoveInBookings = useMemo(() =>
    allBookings.filter(b => b.submitted_by === user?.id && b.order_status === "booking_approved"),
    [allBookings, user?.id]
  );

  const selectedBooking = useMemo(() =>
    pendingMoveInBookings.find(b => b.id === createForm.booking_id) || null,
    [pendingMoveInBookings, createForm.booking_id]
  );

  const filtered = useMemo(() => {
    let list = myBookings;
    if (statusFilter !== "all") list = list.filter(b => b.order_status === statusFilter);
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
        tenant_name: b.tenant_name,
        building: b.room?.building || "",
        order_status: b.order_status,
        created_at: b.created_at,
      };
      return map[key] || "";
    });
  }, [myBookings, statusFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSubmitMoveIn = async () => {
    if (!user || !selectedBooking) {
      toast.error("Please select an approved booking");
      return;
    }
    if (!createForm.payment_method) {
      toast.error("Payment method is required");
      return;
    }
    if (createForm.payment_method === "Bank Transfer" && !createForm.receipt_path.trim()) {
      toast.error("Receipt is required for bank transfer");
      return;
    }
    setSaving(true);
    try {
      const history = [
        ...(selectedBooking.history || []),
        { action: "move_in_submitted", by: user.email, at: new Date().toISOString() },
      ];
      await updateOrderStatus.mutateAsync({
        id: selectedBooking.id,
        order_status: "move_in_submitted",
        reviewed_by: user.id,
        agreement_signed: createForm.agreement_signed,
        payment_method: createForm.payment_method,
        receipt_path: createForm.receipt_path,
        history,
      });
      await logActivity("submit_move_in", "booking", selectedBooking.id, {
        tenant_name: selectedBooking.tenant_name,
      });
      toast.success("Move-in submitted for review");
      setCreateOpen(false);
      setCreateForm({ booking_id: "", agreement_signed: false, payment_method: "", receipt_path: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit move-in");
    } finally {
      setSaving(false);
    }
  };

  const fieldClassName = "w-full rounded-lg border bg-secondary px-4 py-3 text-sm text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClassName = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold">My Move-ins</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit move-in completion for approved bookings.</p>
        </div>
        {pendingMoveInBookings.length > 0 && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Submit Move-in
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="booking_approved">Booking Approved</SelectItem>
            <SelectItem value="move_in_submitted">Move-in Submitted</SelectItem>
            <SelectItem value="move_in_rejected">Move-in Rejected</SelectItem>
            <SelectItem value="move_in_approved">Move-in Approved</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>ID</SortableTableHead>
              <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
              <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
              <TableHead>Room</TableHead>
              <TableHead>Payment</TableHead>
              <SortableTableHead sortKey="order_status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
              <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted</SortableTableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No move-ins found
                </TableCell>
              </TableRow>
            ) : (
              paged.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{b.tenant_name}</TableCell>
                  <TableCell>{b.room?.building || "—"}</TableCell>
                  <TableCell>{b.room ? `${b.room.unit} · ${b.room.room}` : "—"}</TableCell>
                  <TableCell>{b.payment_method || "—"}</TableCell>
                  <TableCell><StatusBadge status={b.order_status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(b.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewItem(b)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
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

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move-in Details</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tenant</span><span className="font-medium">{viewItem.tenant_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span>{viewItem.room?.building || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Unit / Room</span><span>{viewItem.room ? `${viewItem.room.unit} · ${viewItem.room.room}` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Agreement</span><span>{viewItem.agreement_signed ? "✅ Signed" : "❌ Not signed"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{viewItem.payment_method || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={viewItem.order_status} /></div>
              {viewItem.move_in_reject_reason && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                  <strong>Reject Reason:</strong> {viewItem.move_in_reject_reason}
                </div>
              )}
              {viewItem.move_in_cancel_reason && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <strong>Cancel Reason:</strong> {viewItem.move_in_cancel_reason}
                </div>
              )}
              {/* History */}
              {viewItem.history && viewItem.history.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">History</div>
                  {viewItem.history.map((h: any, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <span className="font-medium">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy HH:mm") : ""}
                      {h.reason && <span className="text-destructive"> ({h.reason})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Move-in Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Move-in</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div className="space-y-1">
                <label className={labelClassName}>Approved Booking</label>
                <select
                  className={fieldClassName}
                  value={createForm.booking_id}
                  onChange={e => setCreateForm({ ...createForm, booking_id: e.target.value })}
                >
                  <option value="">Select booking</option>
                  {pendingMoveInBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.tenant_name} — {b.room?.building} {b.room?.unit} {b.room?.room}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBooking && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  <div><strong>Tenant:</strong> {selectedBooking.tenant_name}</div>
                  <div><strong>Move-in Date:</strong> {selectedBooking.move_in_date}</div>
                  <div><strong>Rental:</strong> RM{selectedBooking.monthly_salary}</div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className={labelClassName}>Agreement Signed</label>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={createForm.agreement_signed}
                  onChange={e => setCreateForm({ ...createForm, agreement_signed: e.target.checked })}
                />
                <span className="text-sm">{createForm.agreement_signed ? "Yes" : "No"}</span>
              </div>

              <div className="space-y-1">
                <label className={labelClassName}>Payment Method</label>
                <select
                  className={fieldClassName}
                  value={createForm.payment_method}
                  onChange={e => setCreateForm({ ...createForm, payment_method: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="App / EasyRenz">App / EasyRenz</option>
                </select>
              </div>

              {createForm.payment_method === "Bank Transfer" && (
                <div className="space-y-1">
                  <label className={labelClassName}>Upload Receipt</label>
                  <Input
                    placeholder="Receipt file path or URL"
                    value={createForm.receipt_path}
                    onChange={e => setCreateForm({ ...createForm, receipt_path: e.target.value })}
                  />
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmitMoveIn} disabled={saving || !createForm.booking_id}>
              {saving ? "Submitting..." : "Submit Move-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

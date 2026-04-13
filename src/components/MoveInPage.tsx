import { useState, useMemo, useEffect } from "react";
import { useMoveIns, useUpdateMoveIn, useCreateMoveIn, MoveIn } from "@/hooks/useMoveIns";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useBookings, Booking } from "@/hooks/useBookings";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Eye, Pencil, Check, X, Ban, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

interface UserInfo { id: string; email: string; name: string; }

export function MoveInPage() {
  const { user, role } = useAuth();
  const canCreate = role === "admin" || role === "manager" || role === "boss";
  const { data: moveIns = [], isLoading } = useMoveIns();
  const updateMoveIn = useUpdateMoveIn();
  const createMoveIn = useCreateMoveIn();
  const { data: roomsData = [] } = useRooms();
  const { data: approvedBookings = [] } = useBookings("approved");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [roomFilter, setRoomFilter] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [viewItem, setViewItem] = useState<MoveIn | null>(null);
  const [editItem, setEditItem] = useState<MoveIn | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ booking_id: "", agent_id: "", agreement_signed: false, payment_method: "", receipt_path: "" });
  const [showRejectDialog, setShowRejectDialog] = useState<MoveIn | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState<MoveIn | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserInfo[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map(p => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
  }, []);

  const getAgentName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u?.name || u?.email || id.slice(0, 8);
  };

  const locationOptions = useMemo(() => [...new Set(roomsData.map(r => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map(r => r.building).filter(Boolean))].sort(), [roomsData]);
  const unitOptions = useMemo(() => [...new Set(roomsData.map(r => r.unit).filter(Boolean))].sort(), [roomsData]);
  const roomOptions = useMemo(() => [...new Set(roomsData.map(r => r.room).filter(Boolean))].sort(), [roomsData]);
  const agentOptions = useMemo(() => [...new Set(users.map(u => u.name || u.email).filter(Boolean))].sort(), [users]);
  const paymentOptions = useMemo(() => [...new Set(moveIns.map(m => m.payment_method).filter(Boolean))].sort(), [moveIns]);

  const existingMoveInBookingIds = useMemo(() => new Set(moveIns.map(m => m.booking_id).filter(Boolean)), [moveIns]);
  const agentUsers = useMemo(() => users.filter(u => approvedBookings.some(b => b.submitted_by === u.id)), [users, approvedBookings]);
  const availableCreateBookings = useMemo(() => {
    if (!createForm.agent_id) return [] as Booking[];
    return approvedBookings.filter(b => b.submitted_by === createForm.agent_id && !existingMoveInBookingIds.has(b.id));
  }, [approvedBookings, createForm.agent_id, existingMoveInBookingIds]);
  const selectedCreateBooking = useMemo(() => availableCreateBookings.find(b => b.id === createForm.booking_id) || null, [availableCreateBookings, createForm.booking_id]);

  const filtered = useMemo(() => {
    let list = moveIns;
    if (statusFilter !== "all") list = list.filter(m => m.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(m => m.tenant_name.toLowerCase().includes(s) || m.id.toLowerCase().includes(s));
    }
    if (locationFilter.length) list = list.filter(m => { const r = roomsData.find(rm => rm.id === m.room_id); return r && locationFilter.includes(r.location); });
    if (buildingFilter.length) list = list.filter(m => m.room && buildingFilter.includes(m.room.building));
    if (unitFilter.length) list = list.filter(m => m.room && unitFilter.includes(m.room.unit));
    if (roomFilter.length) list = list.filter(m => m.room && roomFilter.includes(m.room.room));
    if (agentFilter.length) list = list.filter(m => agentFilter.includes(getAgentName(m.agent_id)));
    if (paymentFilter.length) list = list.filter(m => paymentFilter.includes(m.payment_method));
    if (dateFrom) list = list.filter(m => m.created_at >= dateFrom);
    if (dateTo) list = list.filter(m => m.created_at <= dateTo + "T23:59:59");
    return sortData(list, (m: MoveIn, key: string) => {
      const map: Record<string, any> = { id: m.id, tenant_name: m.tenant_name, agent: getAgentName(m.agent_id), building: m.room?.building || "", unit: m.room?.unit || "", room: m.room?.room || "", status: m.status, agreement_signed: m.agreement_signed ? "Yes" : "No", payment_method: m.payment_method, created_at: m.created_at };
      return map[key];
    });
  }, [moveIns, statusFilter, search, sort, locationFilter, buildingFilter, unitFilter, roomFilter, agentFilter, paymentFilter, dateFrom, dateTo, roomsData, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleApprove = async (m: MoveIn) => {
    if (!user) return;
    const history = [...(m.history || []), { action: "approved", by: user.email, at: new Date().toISOString() }];
    await updateMoveIn.mutateAsync({ id: m.id, status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), history });
    await logActivity("approve_move_in", "move_in", m.id, { tenant_name: m.tenant_name });
    toast.success("Move-in approved");
  };

  const handleReject = async () => {
    if (!user || !showRejectDialog || !rejectReason.trim()) { toast.error("Reject reason required"); return; }
    const m = showRejectDialog;
    const history = [...(m.history || []), { action: "rejected", by: user.email, at: new Date().toISOString(), reason: rejectReason }];
    await updateMoveIn.mutateAsync({ id: m.id, status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString(), reject_reason: rejectReason, history });
    await logActivity("reject_move_in", "move_in", m.id, { tenant_name: m.tenant_name, reason: rejectReason });
    toast.success("Move-in rejected");
    setShowRejectDialog(null);
    setRejectReason("");
  };

  const handleCancel = async () => {
    if (!user || !showCancelDialog || !cancelReason.trim()) { toast.error("Cancel reason required"); return; }
    const m = showCancelDialog;
    const history = [...(m.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason: cancelReason }];
    await updateMoveIn.mutateAsync({ id: m.id, status: "cancelled", reviewed_by: user.id, reviewed_at: new Date().toISOString(), cancel_reason: cancelReason, history });
    await logActivity("cancel_move_in", "move_in", m.id, { tenant_name: m.tenant_name, reason: cancelReason });
    toast.success("Move-in cancelled");
    setShowCancelDialog(null);
    setCancelReason("");
  };

  const handleCreate = async () => {
    if (!user || !createForm.agent_id || !selectedCreateBooking) {
      toast.error("Please select agent and approved booking");
      return;
    }
    if (createForm.payment_method === "Bank Transfer" && !createForm.receipt_path.trim()) {
      toast.error("Receipt path is required for bank transfer");
      return;
    }
    setSaving(true);
    try {
      const history = [{ action: "created", by: user.email, at: new Date().toISOString(), created_for_agent: getAgentName(createForm.agent_id) }];
      await createMoveIn.mutateAsync({
        booking_id: selectedCreateBooking.id,
        room_id: selectedCreateBooking.room_id,
        agent_id: createForm.agent_id,
        tenant_name: selectedCreateBooking.tenant_name,
        agreement_signed: createForm.agreement_signed,
        payment_method: createForm.payment_method,
        receipt_path: createForm.receipt_path,
        status: "pending_review",
        history,
      });
      await logActivity("create_move_in", "move_in", selectedCreateBooking.id, {
        tenant_name: selectedCreateBooking.tenant_name,
        building: selectedCreateBooking.room?.building,
        unit: selectedCreateBooking.room?.unit,
        room: selectedCreateBooking.room?.room,
        agent: getAgentName(createForm.agent_id),
      });
      toast.success("Move-in created");
      setCreateOpen(false);
      setCreateForm({ booking_id: "", agent_id: "", agreement_signed: false, payment_method: "", receipt_path: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to create move-in");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: MoveIn) => {
    setEditItem(m);
    setEditForm({ agreement_signed: m.agreement_signed, payment_method: m.payment_method, receipt_path: m.receipt_path });
  };

  const saveEdit = async () => {
    if (!editItem || !user) return;
    setSaving(true);
    try {
      const history = [...(editItem.history || []), { action: "edited", by: user.email, at: new Date().toISOString() }];
      await updateMoveIn.mutateAsync({ id: editItem.id, ...editForm, history });
      await logActivity("edit_move_in", "move_in", editItem.id, { tenant_name: editItem.tenant_name });
      toast.success("Move-in updated");
      setEditItem(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = locationFilter.length > 0 || buildingFilter.length > 0 || unitFilter.length > 0 || roomFilter.length > 0 || agentFilter.length > 0 || paymentFilter.length > 0 || dateFrom || dateTo;
  const clearFilters = () => { setLocationFilter([]); setBuildingFilter([]); setUnitFilter([]); setRoomFilter([]); setAgentFilter([]); setPaymentFilter([]); setDateFrom(""); setDateTo(""); };

  const sectionCard = (emoji: string, title: string, children: React.ReactNode) => (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">{emoji} {title}</div>
      {children}
    </div>
  );
  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );

  const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full text-sm";
  const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  return (
    <div className="space-y-4">
      {createOpen && (
        <Dialog open={createOpen} onOpenChange={(open) => { if (!saving) setCreateOpen(open); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Create Move-In</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              <div className="space-y-5 py-4">
                {sectionCard("👤", "Assign Agent", (
                  <div className="space-y-1">
                    <label className={lbl}>Agent</label>
                    <select className={ic} value={createForm.agent_id} onChange={e => setCreateForm({ booking_id: "", agent_id: e.target.value, agreement_signed: false, payment_method: "", receipt_path: "" })}>
                      <option value="">Select agent</option>
                      {agentUsers.map(agent => <option key={agent.id} value={agent.id}>{agent.name || agent.email}</option>)}
                    </select>
                  </div>
                ))}
                {sectionCard("📋", "Approved Booking", (
                  <div className="space-y-1">
                    <label className={lbl}>Booking</label>
                    <select className={ic} value={createForm.booking_id} onChange={e => setCreateForm({ ...createForm, booking_id: e.target.value })} disabled={!createForm.agent_id}>
                      <option value="">Select approved booking</option>
                      {availableCreateBookings.map(booking => (
                        <option key={booking.id} value={booking.id}>
                          {booking.tenant_name} — {booking.room?.building} {booking.room?.unit} {booking.room?.room}
                        </option>
                      ))}
                    </select>
                    {createForm.agent_id && availableCreateBookings.length === 0 && (
                      <p className="text-xs text-muted-foreground">No eligible approved bookings for this agent.</p>
                    )}
                  </div>
                ))}
                {selectedCreateBooking && sectionCard("🏠", "Booking Summary", (
                  <div>
                    {infoRow("Tenant", selectedCreateBooking.tenant_name)}
                    {infoRow("Building", selectedCreateBooking.room?.building)}
                    {infoRow("Unit", selectedCreateBooking.room?.unit)}
                    {infoRow("Room", selectedCreateBooking.room?.room)}
                    {infoRow("Move In Date", selectedCreateBooking.move_in_date ? format(new Date(selectedCreateBooking.move_in_date), "dd MMM yyyy") : "—")}
                  </div>
                ))}
                {sectionCard("✅", "Confirmation", (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className={lbl}>Agreement Signed</label>
                      <input type="checkbox" checked={createForm.agreement_signed} onChange={e => setCreateForm({ ...createForm, agreement_signed: e.target.checked })} className="h-4 w-4" />
                      <span className="text-sm">{createForm.agreement_signed ? "Yes" : "No"}</span>
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Payment Method</label>
                      <select className={ic} value={createForm.payment_method} onChange={e => setCreateForm({ ...createForm, payment_method: e.target.value })}>
                        <option value="">Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Online Payment">Online Payment</option>
                      </select>
                    </div>
                    {createForm.payment_method === "Bank Transfer" && (
                      <div className="space-y-1">
                        <label className={lbl}>Receipt Path</label>
                        <input className={ic} value={createForm.receipt_path} onChange={e => setCreateForm({ ...createForm, receipt_path: e.target.value })} placeholder="Upload path..." />
                      </div>
                    )}
                  </div>
                ))}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Move-In"}</Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
...
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Move In</h2>
        {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create</Button>}
      </div>

      {/* Search + Status */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search tenant, ID..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="h-3 w-3 mr-1" /> Clear</Button>}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={v => { setLocationFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={v => { setBuildingFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Unit" placeholder="All" options={unitOptions} selected={unitFilter} onApply={v => { setUnitFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Room" placeholder="All" options={roomOptions} selected={roomFilter} onApply={v => { setRoomFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={v => { setAgentFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Payment" placeholder="All" options={paymentOptions} selected={paymentFilter} onApply={v => { setPaymentFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Move-In ID</SortableTableHead>
                <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant Name</SortableTableHead>
                <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="agreement_signed" currentSort={sort} onSort={handleSort}>Agreement</SortableTableHead>
                <SortableTableHead sortKey="payment_method" currentSort={sort} onSort={handleSort}>Payment</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-muted-foreground py-8 text-center">No move-ins found</TableCell></TableRow>
              ) : paged.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs text-center">{m.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium text-center">{m.tenant_name}</TableCell>
                  <TableCell className="text-sm text-center">{getAgentName(m.agent_id)}</TableCell>
                  <TableCell className="text-center">{m.room?.building || "—"}</TableCell>
                  <TableCell className="text-center">{m.room?.unit || "—"}</TableCell>
                  <TableCell className="text-center">{m.room?.room || "—"}</TableCell>
                  <TableCell className="text-center"><StatusBadge status={m.status} /></TableCell>
                  <TableCell className="text-center">{m.agreement_signed ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-center text-sm">{m.payment_method || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground text-center">{format(new Date(m.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" onClick={() => setViewItem(m)} title="View"><Eye className="h-4 w-4" /></Button>
                      {(m.status === "pending_review" || m.status === "rejected") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      )}
                      {m.status === "pending_review" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleApprove(m)} title="Approve"><Check className="h-4 w-4 text-emerald-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowRejectDialog(m)} title="Reject"><X className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                      {(m.status === "pending_review" || m.status === "approved") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowCancelDialog(m)} title="Cancel"><Ban className="h-4 w-4 text-muted-foreground" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
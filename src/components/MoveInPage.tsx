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

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export function MoveInPage() {
  const { user, role } = useAuth();
  const canCreate = role === "admin" || role === "super_admin";
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
  const [editForm, setEditForm] = useState({ agreement_signed: false, payment_method: "", receipt_path: "" });
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
      if (data) setUsers(data.map((p) => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
  }, []);

  const getAgentName = (id: string) => {
    const matched = users.find((item) => item.id === id);
    return matched?.name || matched?.email || id.slice(0, 8);
  };

  const locationOptions = useMemo(() => [...new Set(roomsData.map((r) => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map((r) => r.building).filter(Boolean))].sort(), [roomsData]);
  const unitOptions = useMemo(() => [...new Set(roomsData.map((r) => r.unit).filter(Boolean))].sort(), [roomsData]);
  const roomOptions = useMemo(() => [...new Set(roomsData.map((r) => r.room).filter(Boolean))].sort(), [roomsData]);
  const agentOptions = useMemo(() => [...new Set(users.map((u) => u.name || u.email).filter(Boolean))].sort(), [users]);
  const paymentOptions = useMemo(() => [...new Set(moveIns.map((m) => m.payment_method).filter(Boolean))].sort(), [moveIns]);

  const existingMoveInBookingIds = useMemo(() => new Set(moveIns.map((m) => m.booking_id).filter(Boolean)), [moveIns]);
  const agentUsers = useMemo(
    () => users.filter((u) => approvedBookings.some((b) => b.submitted_by === u.id)),
    [users, approvedBookings],
  );
  const availableCreateBookings = useMemo(() => {
    if (!createForm.agent_id) return [] as Booking[];
    return approvedBookings.filter(
      (booking) => booking.submitted_by === createForm.agent_id && !existingMoveInBookingIds.has(booking.id),
    );
  }, [approvedBookings, createForm.agent_id, existingMoveInBookingIds]);
  const selectedCreateBooking = useMemo(
    () => availableCreateBookings.find((booking) => booking.id === createForm.booking_id) || null,
    [availableCreateBookings, createForm.booking_id],
  );

  const filtered = useMemo(() => {
    let list = moveIns;
    if (statusFilter !== "all") list = list.filter((item) => item.status === statusFilter);
    if (search.trim()) {
      const keyword = search.toLowerCase();
      list = list.filter((item) => item.tenant_name.toLowerCase().includes(keyword) || item.id.toLowerCase().includes(keyword));
    }
    if (locationFilter.length) list = list.filter((item) => {
      const room = roomsData.find((roomItem) => roomItem.id === item.room_id);
      return room && locationFilter.includes(room.location);
    });
    if (buildingFilter.length) list = list.filter((item) => item.room && buildingFilter.includes(item.room.building));
    if (unitFilter.length) list = list.filter((item) => item.room && unitFilter.includes(item.room.unit));
    if (roomFilter.length) list = list.filter((item) => item.room && roomFilter.includes(item.room.room));
    if (agentFilter.length) list = list.filter((item) => agentFilter.includes(getAgentName(item.agent_id)));
    if (paymentFilter.length) list = list.filter((item) => paymentFilter.includes(item.payment_method));
    if (dateFrom) list = list.filter((item) => item.created_at >= dateFrom);
    if (dateTo) list = list.filter((item) => item.created_at <= `${dateTo}T23:59:59`);

    return sortData(list, (item: MoveIn, key: string) => {
      const sortable: Record<string, string> = {
        id: item.id,
        tenant_name: item.tenant_name,
        agent: getAgentName(item.agent_id),
        building: item.room?.building || "",
        unit: item.room?.unit || "",
        room: item.room?.room || "",
        status: item.status,
        agreement_signed: item.agreement_signed ? "Yes" : "No",
        payment_method: item.payment_method,
        created_at: item.created_at,
      };
      return sortable[key] || "";
    });
  }, [moveIns, statusFilter, search, locationFilter, buildingFilter, unitFilter, roomFilter, agentFilter, paymentFilter, dateFrom, dateTo, roomsData, sort, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleApprove = async (item: MoveIn) => {
    if (!user) return;
    const history = [...(item.history || []), { action: "approved", by: user.email, at: new Date().toISOString() }];
    await updateMoveIn.mutateAsync({
      id: item.id,
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      history,
    });
    await logActivity("approve_move_in", "move_in", item.id, { tenant_name: item.tenant_name });
    toast.success("Move-in approved");
  };

  const handleReject = async () => {
    if (!user || !showRejectDialog || !rejectReason.trim()) {
      toast.error("Reject reason required");
      return;
    }
    const item = showRejectDialog;
    const history = [...(item.history || []), { action: "rejected", by: user.email, at: new Date().toISOString(), reason: rejectReason }];
    await updateMoveIn.mutateAsync({
      id: item.id,
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: rejectReason,
      history,
    });
    await logActivity("reject_move_in", "move_in", item.id, { tenant_name: item.tenant_name, reason: rejectReason });
    toast.success("Move-in rejected");
    setShowRejectDialog(null);
    setRejectReason("");
  };

  const handleCancel = async () => {
    if (!user || !showCancelDialog || !cancelReason.trim()) {
      toast.error("Cancel reason required");
      return;
    }
    const item = showCancelDialog;
    const history = [...(item.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason: cancelReason }];
    await updateMoveIn.mutateAsync({
      id: item.id,
      status: "cancelled",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      cancel_reason: cancelReason,
      history,
    });
    await logActivity("cancel_move_in", "move_in", item.id, { tenant_name: item.tenant_name, reason: cancelReason });
    toast.success("Move-in cancelled");
    setShowCancelDialog(null);
    setCancelReason("");
  };

  const handleCreate = async () => {
    if (!user || !createForm.agent_id || !selectedCreateBooking) {
      toast.error("Please select an agent and approved booking");
      return;
    }
    if (!createForm.payment_method) {
      toast.error("Payment method is required");
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
        status: "submitted",
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
    } catch (error: any) {
      toast.error(error.message || "Failed to create move-in");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: MoveIn) => {
    setEditItem(item);
    setEditForm({
      agreement_signed: item.agreement_signed,
      payment_method: item.payment_method,
      receipt_path: item.receipt_path,
    });
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
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters =
    locationFilter.length > 0 ||
    buildingFilter.length > 0 ||
    unitFilter.length > 0 ||
    roomFilter.length > 0 ||
    agentFilter.length > 0 ||
    paymentFilter.length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setLocationFilter([]);
    setBuildingFilter([]);
    setUnitFilter([]);
    setRoomFilter([]);
    setAgentFilter([]);
    setPaymentFilter([]);
    setDateFrom("");
    setDateTo("");
  };

  const sectionCard = (emoji: string, title: string, children: React.ReactNode) => (
    <div className="rounded-lg bg-muted/50 p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2 text-base font-bold">{emoji} {title}</div>
      {children}
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between py-1.5 text-sm gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );

  const fieldClassName = "w-full rounded-lg border bg-secondary px-4 py-3 text-sm text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClassName = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-4">
      {createOpen && (
        <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>Create Move-In</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <div className="space-y-5 py-4">
                {sectionCard("👤", "Assign Agent", (
                  <div className="space-y-1">
                    <label className={labelClassName}>Agent</label>
                    <select
                      className={fieldClassName}
                      value={createForm.agent_id}
                      onChange={(e) => setCreateForm({ booking_id: "", agent_id: e.target.value, agreement_signed: false, payment_method: "", receipt_path: "" })}
                    >
                      <option value="">Select agent</option>
                      {agentUsers.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name || agent.email}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {sectionCard("📋", "Approved Booking", (
                  <div className="space-y-1">
                    <label className={labelClassName}>Booking</label>
                    <select
                      className={fieldClassName}
                      value={createForm.booking_id}
                      disabled={!createForm.agent_id}
                      onChange={(e) => setCreateForm((current) => ({ ...current, booking_id: e.target.value }))}
                    >
                      <option value="">Select approved booking</option>
                      {availableCreateBookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.tenant_name} — {booking.room?.building} {booking.room?.unit} {booking.room?.room}
                        </option>
                      ))}
                    </select>
                    {createForm.agent_id && availableCreateBookings.length === 0 && (
                      <p className="text-xs text-muted-foreground">No eligible approved bookings available for this agent.</p>
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
                      <label className={labelClassName}>Agreement Signed</label>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={createForm.agreement_signed}
                        onChange={(e) => setCreateForm((current) => ({ ...current, agreement_signed: e.target.checked }))}
                      />
                      <span className="text-sm">{createForm.agreement_signed ? "Yes" : "No"}</span>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClassName}>Payment Method</label>
                      <select
                        className={fieldClassName}
                        value={createForm.payment_method}
                        onChange={(e) => setCreateForm((current) => ({ ...current, payment_method: e.target.value }))}
                      >
                        <option value="">Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Online Payment">Online Payment</option>
                      </select>
                    </div>
                    {createForm.payment_method === "Bank Transfer" && (
                      <div className="space-y-1">
                        <label className={labelClassName}>Receipt Path</label>
                        <Input
                          value={createForm.receipt_path}
                          onChange={(e) => setCreateForm((current) => ({ ...current, receipt_path: e.target.value }))}
                          placeholder="Upload path..."
                          className="bg-secondary"
                        />
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

      {viewItem && (
        <Dialog open={Boolean(viewItem)} onOpenChange={(open) => !open && setViewItem(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View Move-In</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <div className="space-y-5 py-4">
                {sectionCard("📋", "Move-In Summary", (
                  <div>
                    {infoRow("Move-In ID", <span className="font-mono text-xs">{viewItem.id}</span>)}
                    {infoRow("Status", <StatusBadge status={viewItem.status} />)}
                    {infoRow("Tenant", viewItem.tenant_name)}
                    {infoRow("Agent", getAgentName(viewItem.agent_id))}
                    {infoRow("Submitted At", format(new Date(viewItem.created_at), "dd MMM yyyy, HH:mm"))}
                    {viewItem.reviewed_at && infoRow("Reviewed At", format(new Date(viewItem.reviewed_at), "dd MMM yyyy, HH:mm"))}
                  </div>
                ))}
                {sectionCard("🏠", "Room", (
                  <div>
                    {infoRow("Building", viewItem.room?.building)}
                    {infoRow("Unit", viewItem.room?.unit)}
                    {infoRow("Room", viewItem.room?.room)}
                  </div>
                ))}
                {sectionCard("✅", "Confirmation", (
                  <div>
                    {infoRow("Agreement Signed", viewItem.agreement_signed ? "Yes ✅" : "No ❌")}
                    {infoRow("Payment Method", viewItem.payment_method || "—")}
                    {viewItem.receipt_path && infoRow("Receipt", viewItem.receipt_path)}
                  </div>
                ))}
                {viewItem.reject_reason && (
                  <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                    <span className="font-semibold">Reject Reason:</span> {viewItem.reject_reason}
                  </div>
                )}
                {viewItem.cancel_reason && (
                  <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    <span className="font-semibold">Cancel Reason:</span> {viewItem.cancel_reason}
                  </div>
                )}
                {(viewItem.history || []).length > 0 && sectionCard("📜", "History", (
                  <div className="space-y-2">
                    {(viewItem.history || []).map((historyItem: any, index: number) => (
                      <div key={index} className="rounded-lg border bg-background p-3 text-xs">
                        <span className="font-semibold capitalize">{historyItem.action}</span> by {historyItem.by} — {historyItem.at ? format(new Date(historyItem.at), "dd MMM yyyy, HH:mm") : ""}
                        {historyItem.reason && <div className="mt-1 text-muted-foreground">Reason: {historyItem.reason}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {editItem && (
        <Dialog open={Boolean(editItem)} onOpenChange={(open) => !open && !saving && setEditItem(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Edit Move-In — {editItem.tenant_name}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <div className="space-y-5 py-4">
                {sectionCard("✅", "Confirmation Details", (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className={labelClassName}>Agreement Signed</label>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={editForm.agreement_signed}
                        onChange={(e) => setEditForm((current) => ({ ...current, agreement_signed: e.target.checked }))}
                      />
                      <span className="text-sm">{editForm.agreement_signed ? "Yes" : "No"}</span>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClassName}>Payment Method</label>
                      <select className={fieldClassName} value={editForm.payment_method} onChange={(e) => setEditForm((current) => ({ ...current, payment_method: e.target.value }))}>
                        <option value="">Select</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Online Payment">Online Payment</option>
                      </select>
                    </div>
                    {editForm.payment_method === "Bank Transfer" && (
                      <div className="space-y-1">
                        <label className={labelClassName}>Receipt Path</label>
                        <Input className="bg-secondary" value={editForm.receipt_path} onChange={(e) => setEditForm((current) => ({ ...current, receipt_path: e.target.value }))} placeholder="Upload path..." />
                      </div>
                    )}
                  </div>
                ))}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={Boolean(showRejectDialog)} onOpenChange={(open) => !open && (setShowRejectDialog(null), setRejectReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Move-In?</AlertDialogTitle>
            <AlertDialogDescription>Please enter the reason for rejection.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reject reason (required)..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim()} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(showCancelDialog)} onOpenChange={(open) => !open && (setShowCancelDialog(null), setCancelReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Move-In?</AlertDialogTitle>
            <AlertDialogDescription>Please enter the reason for cancellation.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Cancel reason (required)..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={!cancelReason.trim()}>Cancel Move-In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Move In</h2>
        {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Create</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search tenant, ID..." className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="mr-1 h-3 w-3" /> Clear</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={(value) => { setLocationFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={(value) => { setBuildingFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Unit" placeholder="All" options={unitOptions} selected={unitFilter} onApply={(value) => { setUnitFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Room" placeholder="All" options={roomOptions} selected={roomFilter} onApply={(value) => { setRoomFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={(value) => { setAgentFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Payment" placeholder="All" options={paymentOptions} selected={paymentFilter} onApply={(value) => { setPaymentFilter(value); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date From</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
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
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No move-ins found</TableCell></TableRow>
              ) : paged.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{item.tenant_name}</TableCell>
                  <TableCell className="text-sm">{getAgentName(item.agent_id)}</TableCell>
                  <TableCell>{item.room?.building || "—"}</TableCell>
                  <TableCell>{item.room?.unit || "—"}</TableCell>
                  <TableCell>{item.room?.room || "—"}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell>{item.agreement_signed ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-sm">{item.payment_method || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(item.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewItem(item)} title="View"><Eye className="h-4 w-4" /></Button>
                      {(item.status === "submitted" || item.status === "rejected") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      )}
                      {item.status === "submitted" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleApprove(item)} title="Approve"><Check className="h-4 w-4 text-primary" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setShowRejectDialog(item)} title="Reject"><X className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                      {(item.status === "submitted" || item.status === "approved") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowCancelDialog(item)} title="Cancel"><Ban className="h-4 w-4 text-muted-foreground" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(0); }}>
            <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

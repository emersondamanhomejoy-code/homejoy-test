import { useState, useMemo, useEffect } from "react";
import { useMoveIns, useUpdateMoveIn, MoveIn } from "@/hooks/useMoveIns";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
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
  const { data: moveIns = [], isLoading } = useMoveIns();
  const updateMoveIn = useUpdateMoveIn();
  const { data: roomsData = [] } = useRooms();

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
      {/* View Modal */}
      {viewItem && (
        <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View Move-In</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
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
                    {viewItem.receipt_path && infoRow("Receipt", <a href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/booking-docs/${viewItem.receipt_path}`} target="_blank" className="text-primary hover:underline text-xs">View Receipt</a>)}
                  </div>
                ))}
                {viewItem.reject_reason && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                    <span className="font-semibold">Reject Reason:</span> {viewItem.reject_reason}
                  </div>
                )}
                {viewItem.cancel_reason && (
                  <div className="bg-muted text-muted-foreground rounded-lg p-4 text-sm">
                    <span className="font-semibold">Cancel Reason:</span> {viewItem.cancel_reason}
                  </div>
                )}
                {/* History */}
                {(viewItem.history || []).length > 0 && sectionCard("📜", "History", (
                  <div className="space-y-2">
                    {(viewItem.history || []).map((h: any, i: number) => (
                      <div key={i} className="text-xs bg-background rounded-lg border p-3">
                        <span className="font-semibold capitalize">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}
                        {h.reason && <div className="text-muted-foreground mt-1">Reason: {h.reason}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={(open) => { if (!open && !saving) setEditItem(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Edit Move-In — {editItem.tenant_name}</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              <div className="space-y-5 py-4">
                {sectionCard("✅", "Confirmation Details", (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className={lbl}>Agreement Signed</label>
                      <input type="checkbox" checked={editForm.agreement_signed} onChange={e => setEditForm({ ...editForm, agreement_signed: e.target.checked })} className="h-4 w-4" />
                      <span className="text-sm">{editForm.agreement_signed ? "Yes" : "No"}</span>
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Payment Method</label>
                      <select className={ic} value={editForm.payment_method} onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })}>
                        <option value="">Select</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Online Payment">Online Payment</option>
                      </select>
                    </div>
                    {editForm.payment_method === "Bank Transfer" && (
                      <div className="space-y-1">
                        <label className={lbl}>Receipt (file path)</label>
                        <input className={ic} value={editForm.receipt_path} onChange={e => setEditForm({ ...editForm, receipt_path: e.target.value })} placeholder="Upload path..." />
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

      {/* Reject Dialog */}
      <AlertDialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Move-In?</AlertDialogTitle>
            <AlertDialogDescription>Please enter the reason for rejection.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reject reason (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim()} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={!!showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Move-In?</AlertDialogTitle>
            <AlertDialogDescription>Please enter the reason for cancellation.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Cancel reason (required)..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={!cancelReason.trim()}>Cancel Move-In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Move In</h2>
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
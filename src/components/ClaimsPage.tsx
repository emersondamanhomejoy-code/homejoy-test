import { useState, useMemo, useEffect } from "react";
import { useClaims, useUpdateClaimStatus, Claim } from "@/hooks/useClaims";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useBookings } from "@/hooks/useBookings";
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
import { Eye, Pencil, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface UserInfo { id: string; email: string; name: string; }

export function ClaimsPage() {
  const { user, role } = useAuth();
  const { data: allClaims = [], isLoading } = useClaims();
  const updateClaimStatus = useUpdateClaimStatus();
  const { data: allBookings = [] } = useBookings();
  const { data: roomsData = [] } = useRooms();
  const isBossManager = role === "boss" || role === "manager";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [viewClaim, setViewClaim] = useState<Claim | null>(null);
  const [editClaim, setEditClaim] = useState<Claim | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState<Claim | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState<Claim | null>(null);

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

  const agentOptions = useMemo(() => [...new Set(users.map(u => u.name || u.email).filter(Boolean))].sort(), [users]);
  const locationOptions = useMemo(() => [...new Set(roomsData.map(r => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map(r => r.building).filter(Boolean))].sort(), [roomsData]);

  const filtered = useMemo(() => {
    let list = allClaims;
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(c => c.id.toLowerCase().includes(s) || c.description.toLowerCase().includes(s) || getAgentName(c.agent_id).toLowerCase().includes(s));
    }
    if (agentFilter.length) list = list.filter(c => agentFilter.includes(getAgentName(c.agent_id)));
    if (dateFrom) list = list.filter(c => c.created_at >= dateFrom);
    if (dateTo) list = list.filter(c => c.created_at <= dateTo + "T23:59:59");
    return sortData(list, (c: Claim, key: string) => {
      const map: Record<string, any> = { id: c.id, agent: getAgentName(c.agent_id), amount: c.amount, status: c.status, created_at: c.created_at };
      return map[key];
    });
  }, [allClaims, statusFilter, search, sort, agentFilter, dateFrom, dateTo, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleApprove = async (c: Claim) => {
    if (!user) return;
    await updateClaimStatus.mutateAsync({ id: c.id, status: "approved", reviewed_by: user.id });
    await logActivity("approve_claim", "claim", c.id, { amount: c.amount });
    toast.success("Claim approved");
    setViewClaim(null);
  };

  const handleReject = async () => {
    if (!user || !showRejectDialog || !rejectReason.trim()) { toast.error("Reject reason required"); return; }
    const c = showRejectDialog;
    await updateClaimStatus.mutateAsync({ id: c.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason });
    await logActivity("reject_claim", "claim", c.id, { amount: c.amount, reason: rejectReason });
    toast.success("Claim rejected");
    setShowRejectDialog(null);
    setRejectReason("");
    setViewClaim(null);
  };

  const handleCancel = async () => {
    if (!user || !showCancelDialog || !cancelReason.trim()) { toast.error("Cancel reason required"); return; }
    const c = showCancelDialog;
    await updateClaimStatus.mutateAsync({ id: c.id, status: "cancelled", reviewed_by: user.id, reject_reason: cancelReason });
    await logActivity("cancel_claim", "claim", c.id, { amount: c.amount, reason: cancelReason });
    toast.success("Claim cancelled");
    setShowCancelDialog(null);
    setCancelReason("");
    setViewClaim(null);
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    await supabase.from("claims").delete().eq("id", showDeleteDialog.id);
    await logActivity("delete_claim", "claim", showDeleteDialog.id, { amount: showDeleteDialog.amount });
    toast.success("Claim deleted");
    setShowDeleteDialog(null);
    setViewClaim(null);
  };

  const hasActiveFilters = agentFilter.length > 0 || locationFilter.length > 0 || buildingFilter.length > 0 || dateFrom || dateTo;
  const clearFilters = () => { setAgentFilter([]); setLocationFilter([]); setBuildingFilter([]); setDateFrom(""); setDateTo(""); };

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

  const renderClaimModal = (claim: Claim, editable: boolean) => {
    const linkedBooking = allBookings.find(b => b.id === claim.booking_id);
    return (
      <div className="space-y-5 py-4">
        {sectionCard("📋", "Claim Summary", (
          <div>
            {infoRow("Claim ID", <span className="font-mono text-xs">{claim.id}</span>)}
            {infoRow("Agent", getAgentName(claim.agent_id))}
            {infoRow("Status", <StatusBadge status={claim.status} />)}
            {infoRow("Amount", `RM${Number(claim.amount).toLocaleString()}`)}
            {infoRow("Submitted At", format(new Date(claim.created_at), "dd MMM yyyy, HH:mm"))}
            {claim.reviewed_at && infoRow("Reviewed At", format(new Date(claim.reviewed_at), "dd MMM yyyy, HH:mm"))}
          </div>
        ))}
        {linkedBooking && sectionCard("📋", "Linked Booking", (
          <div>
            {infoRow("Tenant", linkedBooking.tenant_name)}
            {infoRow("Room", `${linkedBooking.room?.building || ""} ${linkedBooking.room?.unit || ""} ${linkedBooking.room?.room || ""}`)}
            {infoRow("Move-in Date", linkedBooking.move_in_date)}
            {infoRow("Duration", `${linkedBooking.contract_months} months`)}
          </div>
        ))}
        {sectionCard("💰", "Details", (
          <div>
            {infoRow("Description", claim.description)}
            {infoRow("Bank", claim.bank_name ? `${claim.bank_name} · ${claim.bank_account} · ${claim.account_holder}` : "—")}
          </div>
        ))}
        {claim.reject_reason && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            <span className="font-semibold">Reject/Cancel Reason:</span> {claim.reject_reason}
          </div>
        )}
        {/* History */}
        {((claim as any).history || []).length > 0 && sectionCard("📜", "History", (
          <div className="space-y-2">
            {((claim as any).history || []).map((h: any, i: number) => (
              <div key={i} className="text-xs bg-background rounded-lg border p-3">
                <span className="font-semibold capitalize">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}
                {h.reason && <div className="text-muted-foreground mt-1">Reason: {h.reason}</div>}
              </div>
            ))}
          </div>
        ))}
        {/* Actions */}
        {claim.status === "pending" && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleApprove(claim)} className="bg-emerald-600 hover:bg-emerald-700 text-white">✅ Approve</Button>
            <Button variant="destructive" onClick={() => { setShowRejectDialog(claim); }}>❌ Reject</Button>
            <Button variant="outline" onClick={() => { setShowCancelDialog(claim); }}>🚫 Cancel</Button>
          </div>
        )}
        {(claim.status === "rejected" || claim.status === "cancelled") && (
          <Button variant="outline" className="text-destructive" onClick={() => setShowDeleteDialog(claim)}>🗑️ Delete</Button>
        )}
        {claim.status === "approved" && isBossManager && (
          <Button variant="outline" className="text-muted-foreground" onClick={() => { setShowCancelDialog(claim); }}>🔄 Adjust / Cancel (Manager Override)</Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Modal */}
      {viewClaim && (
        <Dialog open={!!viewClaim} onOpenChange={(open) => { if (!open) setViewClaim(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View Claim</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              {renderClaimModal(allClaims.find(c => c.id === viewClaim.id) || viewClaim, false)}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Dialog */}
      <AlertDialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reject Claim?</AlertDialogTitle><AlertDialogDescription>Enter the rejection reason.</AlertDialogDescription></AlertDialogHeader>
          <Textarea placeholder="Reason (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim()} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={!!showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel Claim?</AlertDialogTitle><AlertDialogDescription>Enter the cancellation reason.</AlertDialogDescription></AlertDialogHeader>
          <Textarea placeholder="Reason (required)..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={!cancelReason.trim()}>Cancel Claim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Claim?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Claims</h2>
      </div>

      {/* Search + Status */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search ID, agent, description..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="h-3 w-3 mr-1" /> Clear</Button>}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={v => { setAgentFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={v => { setLocationFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={v => { setBuildingFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date To</label>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10" />
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
                <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Claim ID</SortableTableHead>
                <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="amount" currentSort={sort} onSort={handleSort}>Amount</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground py-8 text-center">No claims found</TableCell></TableRow>
              ) : paged.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-center">{c.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm text-center">{getAgentName(c.agent_id)}</TableCell>
                  <TableCell className="font-medium text-center">RM{Number(c.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-center"><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground text-center">{format(new Date(c.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" onClick={() => setViewClaim(c)} title="View"><Eye className="h-4 w-4" /></Button>
                      {(c.status === "pending") && (
                        <Button variant="ghost" size="icon" onClick={() => setViewClaim(c)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      )}
                      {(c.status === "rejected" || c.status === "cancelled") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(c)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                      {(c.status === "pending" || c.status === "approved") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowCancelDialog(c)} title="Cancel"><X className="h-4 w-4 text-muted-foreground" /></Button>
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
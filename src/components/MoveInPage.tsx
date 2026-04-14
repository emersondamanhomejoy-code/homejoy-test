import { useState, useMemo, useEffect } from "react";
import { useMoveIns, useUpdateMoveIn, MoveIn } from "@/hooks/useMoveIns";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useBookings, Booking, BOOKING_TYPE_LABELS, BookingType } from "@/hooks/useBookings";
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
import { Eye, Pencil, Check, X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

interface UserInfo { id: string; email: string; name: string; }

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "ready_for_move_in", label: "Ready for Move-in" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
  { value: "reversed", label: "Reversed" },
];

export function MoveInPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const isAgent = role === "agent";
  const queryClient = useQueryClient();
  const { data: moveIns = [], isLoading } = useMoveIns();
  const updateMoveIn = useUpdateMoveIn();
  const { data: roomsData = [] } = useRooms();
  const { data: allBookings = [] } = useBookings();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [viewItem, setViewItem] = useState<MoveIn | null>(null);
  const [editItem, setEditItem] = useState<MoveIn | null>(null);
  const [editForm, setEditForm] = useState({ agreement_signed: false, payment_method: "", remarks: "" });
  const [showApproveDialog, setShowApproveDialog] = useState<MoveIn | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<MoveIn | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReverseDialog, setShowReverseDialog] = useState<MoveIn | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submitValidation = useFormValidation();
  const rejectValidation = useFormValidation();
  const reverseValidation = useFormValidation();

  const [users, setUsers] = useState<UserInfo[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map((p) => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
  }, []);

  const getAgentName = (id: string) => {
    const matched = users.find((u) => u.id === id);
    return matched?.name || matched?.email || id.slice(0, 8);
  };

  // Get booking for a move-in
  const getBooking = (bookingId: string | null) => allBookings.find(b => b.id === bookingId);

  // Get room details
  const getRoom = (roomId: string | null) => roomsData.find(r => r.id === roomId);

  const locationOptions = useMemo(() => [...new Set(roomsData.map(r => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map(r => r.building).filter(Boolean))].sort(), [roomsData]);
  const agentOptions = useMemo(() => [...new Set(users.map(u => u.name || u.email).filter(Boolean))].sort(), [users]);
  const paymentOptions = ["EasyRenz App", "Bank Transfer"];

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: moveIns.length };
    moveIns.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
    return counts;
  }, [moveIns]);

  const filtered = useMemo(() => {
    let list = moveIns;
    if (statusFilter !== "all") list = list.filter(m => m.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(m => {
        const room = getRoom(m.room_id);
        return m.tenant_name.toLowerCase().includes(s) ||
          (m.room?.building || "").toLowerCase().includes(s) ||
          (m.room?.unit || "").toLowerCase().includes(s) ||
          (m.room?.room || "").toLowerCase().includes(s) ||
          (room?.room_title || "").toLowerCase().includes(s);
      });
    }
    if (agentFilter.length) list = list.filter(m => agentFilter.includes(getAgentName(m.agent_id)));
    if (buildingFilter.length) list = list.filter(m => m.room && buildingFilter.includes(m.room.building));
    if (locationFilter.length) list = list.filter(m => {
      const room = getRoom(m.room_id);
      return room && locationFilter.includes(room.location);
    });
    if (bookingTypeFilter.length) list = list.filter(m => {
      const booking = getBooking(m.booking_id);
      return booking && bookingTypeFilter.includes(booking.booking_type);
    });
    if (paymentFilter.length) list = list.filter(m => paymentFilter.includes(m.payment_method));
    if (dateFrom) list = list.filter(m => m.created_at >= dateFrom);
    if (dateTo) list = list.filter(m => m.created_at <= `${dateTo}T23:59:59`);

    return sortData(list, (item: MoveIn, key: string) => {
      const room = getRoom(item.room_id);
      const booking = getBooking(item.booking_id);
      const sortable: Record<string, string> = {
        tenant_name: item.tenant_name,
        agent: getAgentName(item.agent_id),
        building: item.room?.building || "",
        unit: item.room?.unit || "",
        room: item.room?.room || "",
        room_title: room?.room_title || "",
        booking_type: booking?.booking_type || "",
        status: item.status,
        payment_method: item.payment_method,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
      return sortable[key] || "";
    });
  }, [moveIns, statusFilter, search, agentFilter, buildingFilter, locationFilter, bookingTypeFilter, paymentFilter, dateFrom, dateTo, roomsData, allBookings, sort, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // ─── AGENT SUBMIT ───
  const handleAgentSubmit = async (item: MoveIn) => {
    if (!user) return;
    // Check if related booking was terminated
    const booking = getBooking(item.booking_id);
    if (booking && booking.status === "cancelled") {
      toast.error("This booking has been terminated. You cannot submit this move-in.");
      return;
    }
    const submitRules = { payment_method: (v: any) => !editForm.payment_method ? "Payment method is required" : null };
    if (!submitValidation.validate({ payment_method: editForm.payment_method }, submitRules)) return;
    setSaving(true);
    try {
      const history = [...(item.history || []), { action: "submitted", by: user.email, at: new Date().toISOString() }];
      await updateMoveIn.mutateAsync({
        id: item.id,
        status: "submitted",
        agreement_signed: editForm.agreement_signed,
        payment_method: editForm.payment_method,
        history,
        updated_at: new Date().toISOString(),
      });
      await logActivity("submit_move_in", "move_in", item.id, { tenant_name: item.tenant_name });
      toast.success("Move-in submitted");
      setEditItem(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  // ─── ADMIN APPROVE ───
  const handleApprove = async () => {
    if (!user || !showApproveDialog) return;
    const item = showApproveDialog;
    setSaving(true);
    try {
      const history = [...(item.history || []), { action: "approved", by: user.email, at: new Date().toISOString() }];
      await updateMoveIn.mutateAsync({
        id: item.id,
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        history,
      });

      // Set room to Occupied
      if (item.room_id) {
        await supabase.from("rooms").update({ status: "Occupied" }).eq("id", item.room_id);
      }

      // Set carpark rooms to Occupied if any
      const booking = getBooking(item.booking_id);
      if (booking) {
        const docs = booking.documents as any;
        const carParkSelections: { roomId: string }[] = docs?.carParkSelections || [];
        for (const cp of carParkSelections) {
          if (cp.roomId) {
            await supabase.from("rooms").update({ status: "Occupied" }).eq("id", cp.roomId);
          }
        }
      }

      // Auto-create earnings record
      if (booking) {
        // Fetch agent's commission config
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("commission_type, commission_config")
          .eq("user_id", item.agent_id)
          .eq("role", "agent")
          .single();

        const commType = roleData?.commission_type || "internal_basic";
        const commConfig = roleData?.commission_config as any;
        const rent = booking.monthly_salary || 0;
        const duration = booking.contract_months || 12;
        const durationMultiplier = duration / 12;

        let commissionAmount = 0;
        if (commType === "external") {
          commissionAmount = Math.round(rent * (commConfig?.percentage ?? 100) / 100 * durationMultiplier);
        } else if (commType === "internal_full") {
          const tiers = commConfig?.tiers || [{ min: 1, max: 300, percentage: 70 }];
          const tier = tiers.find((t: any) => true); // use first match
          commissionAmount = Math.round(rent * (tier?.percentage ?? 70) / 100 * durationMultiplier);
        } else {
          const tiers = commConfig?.tiers || [{ min: 1, max: 5, amount: 200 }];
          const tier = tiers.find((t: any) => true);
          commissionAmount = Math.round((tier?.amount ?? 200) * durationMultiplier);
        }

        const room = getRoom(item.room_id);
        const now = new Date();
        const payCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        await supabase.from("earnings").insert({
          agent_id: item.agent_id,
          booking_id: item.booking_id,
          move_in_id: item.id,
          room_id: item.room_id,
          tenant_name: item.tenant_name,
          building: room?.building || item.room?.building || "",
          unit: room?.unit || item.room?.unit || "",
          room: room?.room || item.room?.room || "",
          exact_rental: rent,
          commission_type: commType,
          commission_amount: commissionAmount,
          status: "pending",
          pay_cycle: payCycle,
        });
      }

      await logActivity("approve_move_in", "move_in", item.id, { tenant_name: item.tenant_name });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      toast.success("Move-in approved — room set to Occupied, earnings created");
      setShowApproveDialog(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── ADMIN REJECT ───
  const handleReject = async () => {
    if (!user || !showRejectDialog) return;
    const rejectRules = { rejectReason: () => !rejectReason.trim() ? "Reject reason is required" : null };
    if (!rejectValidation.validate({ rejectReason }, rejectRules)) return;
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

  // ─── ADMIN REVERSE ───
  const handleReverse = async () => {
    if (!user || !showReverseDialog) return;
    const reverseRules = { reverseReason: () => !reverseReason.trim() ? "Reverse reason is required" : null };
    if (!reverseValidation.validate({ reverseReason }, reverseRules)) return;
    const item = showReverseDialog;
    setSaving(true);
    try {
      const history = [...(item.history || []), { action: "reversed", by: user.email, at: new Date().toISOString(), reason: reverseReason }];
      await updateMoveIn.mutateAsync({
        id: item.id,
        status: "reversed",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: reverseReason,
        history,
      });

      // Release room back to Pending (was Occupied from approval)
      if (item.room_id) {
        await supabase.from("rooms").update({ status: "Pending" }).eq("id", item.room_id);
      }

      // Release carparks
      const booking = getBooking(item.booking_id);
      if (booking) {
        const docs = booking.documents as any;
        const carParkSelections: { roomId: string }[] = docs?.carParkSelections || [];
        for (const cp of carParkSelections) {
          if (cp.roomId) {
            await supabase.from("rooms").update({ status: "Pending" }).eq("id", cp.roomId);
          }
        }
      }

      // Remove tenant_rooms binding created by approval
      if (item.booking_id) {
        const { data: tenantRooms } = await supabase
          .from("tenant_rooms")
          .select("id")
          .eq("room_id", item.room_id || "")
          .eq("status", "active");
        if (tenantRooms && tenantRooms.length > 0) {
          for (const tr of tenantRooms) {
            await supabase.from("tenant_rooms").update({ status: "reversed" }).eq("id", tr.id);
          }
        }
      }

      await logActivity("reverse_move_in", "move_in", item.id, { tenant_name: item.tenant_name, reason: reverseReason });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_rooms"] });
      toast.success("Move-in reversed — occupancy removed");
      setShowReverseDialog(null);
      setReverseReason("");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: MoveIn) => {
    setEditItem(item);
    setEditForm({
      agreement_signed: item.agreement_signed,
      payment_method: item.payment_method,
      remarks: "",
    });
  };

  const saveEdit = async () => {
    if (!editItem || !user) return;
    setSaving(true);
    try {
      const history = [...(editItem.history || []), { action: "edited", by: user.email, at: new Date().toISOString() }];
      await updateMoveIn.mutateAsync({
        id: editItem.id,
        agreement_signed: editForm.agreement_signed,
        payment_method: editForm.payment_method,
        history,
        updated_at: new Date().toISOString(),
      });
      await logActivity("edit_move_in", "move_in", editItem.id, { tenant_name: editItem.tenant_name });
      toast.success("Move-in updated");
      setEditItem(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = agentFilter.length > 0 || buildingFilter.length > 0 || locationFilter.length > 0 || bookingTypeFilter.length > 0 || paymentFilter.length > 0 || Boolean(dateFrom) || Boolean(dateTo);
  const clearFilters = () => { setAgentFilter([]); setBuildingFilter([]); setLocationFilter([]); setBookingTypeFilter([]); setPaymentFilter([]); setDateFrom(""); setDateTo(""); };

  const sectionCard = (title: string, children: React.ReactNode) => (
    <div className="rounded-lg bg-muted/50 p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
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

  // Check if move-in is blocked (booking terminated)
  const isMoveInBlocked = (item: MoveIn) => {
    if (item.status === "closed") return true;
    const booking = getBooking(item.booking_id);
    return booking?.status === "cancelled";
  };

  return (
    <div className="space-y-4">
      {/* View Dialog */}
      {viewItem && (() => {
        const room = getRoom(viewItem.room_id);
        const booking = getBooking(viewItem.booking_id);
        return (
          <Dialog open={Boolean(viewItem)} onOpenChange={(open) => !open && setViewItem(null)}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View Move-In</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
                <div className="space-y-4 py-4">
                  {sectionCard("Move-In Summary", (
                    <div>
                      {infoRow("Move-In ID", <span className="font-mono text-xs">{viewItem.id.slice(0, 8)}…</span>)}
                      {infoRow("Status", <StatusBadge status={viewItem.status} />)}
                      {infoRow("Tenant", viewItem.tenant_name)}
                      {infoRow("Agent", getAgentName(viewItem.agent_id))}
                      {booking && infoRow("Booking Type", BOOKING_TYPE_LABELS[(booking.booking_type || "room_only") as BookingType])}
                      {infoRow("Agreement Signed", viewItem.agreement_signed ? "Yes ✅" : "No ❌")}
                      {infoRow("Payment Method", viewItem.payment_method || "—")}
                      {infoRow("Created At", format(new Date(viewItem.created_at), "dd MMM yyyy, HH:mm"))}
                      {viewItem.reviewed_at && infoRow("Reviewed At", format(new Date(viewItem.reviewed_at), "dd MMM yyyy, HH:mm"))}
                      {viewItem.reviewed_by && infoRow("Reviewed By", getAgentName(viewItem.reviewed_by))}
                    </div>
                  ))}

                  {sectionCard("Room & Parking", (
                    <div>
                      {infoRow("Building", viewItem.room?.building)}
                      {infoRow("Unit", viewItem.room?.unit)}
                      {infoRow("Room", viewItem.room?.room)}
                      {infoRow("Room Title", room?.room_title)}
                      {infoRow("Room Status", room?.status)}
                      {booking && infoRow("Move-in Date", booking.move_in_date)}
                      {booking && infoRow("Contract", `${booking.contract_months} months`)}
                    </div>
                  ))}

                  {viewItem.reject_reason && (
                    <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                      <span className="font-semibold">Reject Reason:</span> {viewItem.reject_reason}
                    </div>
                  )}
                  {viewItem.cancel_reason && (
                    <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      <span className="font-semibold">Close / Cancel Reason:</span> {viewItem.cancel_reason}
                    </div>
                  )}

                  {(viewItem.history || []).length > 0 && sectionCard("History", (
                    <div className="space-y-2">
                      {(viewItem.history || []).map((h: any, i: number) => (
                        <div key={i} className="rounded-lg border bg-background p-3 text-xs">
                          <span className="font-semibold capitalize">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}
                          {h.reason && <div className="mt-1 text-muted-foreground">Reason: {h.reason}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter className="px-6 pb-6">
                <Button variant="outline" onClick={() => setViewItem(null)}>Close</Button>
                {/* Admin actions in view */}
                {isAdmin && viewItem.status === "submitted" && (
                  <>
                    <Button variant="destructive" onClick={() => { setViewItem(null); setShowRejectDialog(viewItem); }}>Reject</Button>
                    <Button onClick={() => { setViewItem(null); setShowApproveDialog(viewItem); }} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
                  </>
                )}
                {isAdmin && viewItem.status === "approved" && (
                  <Button variant="destructive" onClick={() => { setViewItem(null); setShowReverseDialog(viewItem); }}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reverse Record
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit/Submit Dialog (Agent) */}
      {editItem && (
        <Dialog open={Boolean(editItem)} onOpenChange={(open) => !open && !saving && setEditItem(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>{editItem.status === "ready_for_move_in" || editItem.status === "rejected" ? "Submit Move-In" : "Edit Move-In"} — {editItem.tenant_name}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
               <div className="space-y-5 py-4">
                <FormErrorBanner errors={submitValidation.errors} />
                {isMoveInBlocked(editItem) && (
                  <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive font-medium">
                    ⚠️ This booking has been terminated. No further submissions are allowed.
                  </div>
                )}

                {sectionCard("Confirmation Details", (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className={labelClassName}>Agreement Signed</label>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={editForm.agreement_signed}
                        onChange={(e) => setEditForm(f => ({ ...f, agreement_signed: e.target.checked }))}
                        disabled={isMoveInBlocked(editItem)}
                      />
                      <span className="text-sm">{editForm.agreement_signed ? "Yes" : "No"}</span>
                    </div>
                    <div className="space-y-1" data-field="payment_method">
                      <label className={labelClassName}>Payment Method *</label>
                      <select
                        className={fieldClass(fieldClassName, !!submitValidation.errors.payment_method)}
                        value={editForm.payment_method}
                        onChange={(e) => { setEditForm(f => ({ ...f, payment_method: e.target.value })); submitValidation.clearError("payment_method"); }}
                        disabled={isMoveInBlocked(editItem)}
                      >
                        <option value="">Select payment method</option>
                        <option value="EasyRenz App">EasyRenz App</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                      <FieldError error={submitValidation.errors.payment_method} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClassName}>Remarks</label>
                      <Textarea
                        placeholder="Any remarks..."
                        value={editForm.remarks}
                        onChange={(e) => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                        rows={2}
                        disabled={isMoveInBlocked(editItem)}
                      />
                    </div>
                  </div>
                ))}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancel</Button>
                  {(editItem.status === "ready_for_move_in" || editItem.status === "rejected") && !isMoveInBlocked(editItem) ? (
                    <Button onClick={() => handleAgentSubmit(editItem)} disabled={saving || !editForm.payment_method}>
                      {saving ? "Submitting..." : "Submit Move-In"}
                    </Button>
                  ) : !isMoveInBlocked(editItem) ? (
                    <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                  ) : null}
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={Boolean(showApproveDialog)} onOpenChange={(open) => !open && setShowApproveDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Move-In?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve move-in for <strong>{showApproveDialog?.tenant_name}</strong>?
              Room/carpark will be set to <strong>Occupied</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={saving} className="bg-green-600 hover:bg-green-700">
              Yes, Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={Boolean(showRejectDialog)} onOpenChange={(open) => !open && (setShowRejectDialog(null), setRejectReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Move-In?</AlertDialogTitle>
            <AlertDialogDescription>Please enter the reason for rejection.</AlertDialogDescription>
          </AlertDialogHeader>
          <div data-field="rejectReason">
            <Textarea className={fieldClass("", !!rejectValidation.errors.rejectReason)} placeholder="Reject reason (required)..." value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); rejectValidation.clearError("rejectReason"); }} rows={3} />
            <FieldError error={rejectValidation.errors.rejectReason} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim()} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Dialog */}
      <Dialog open={Boolean(showReverseDialog)} onOpenChange={(open) => { if (!open) { setShowReverseDialog(null); setReverseReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse Move-In</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will reverse the approved move-in for <strong>{showReverseDialog?.tenant_name}</strong>.
              Occupancy will be removed and room set back to Pending.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason *</label>
              <Textarea placeholder="Why is this move-in being reversed?" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReverseDialog(null); setReverseReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReverse} disabled={!reverseReason.trim() || saving}>
              {saving ? "Reversing..." : "Reverse Move-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Move In</h2>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label} {statusCounts[tab.value] ? `(${statusCounts[tab.value]})` : "(0)"}
          </button>
        ))}
      </div>

      {/* Search + Agent Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search tenant, building, unit, room..." className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={(v) => { setAgentFilter(v); setPage(0); }} />
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="mr-1 h-3 w-3" /> Clear</Button>}
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MultiSelectFilter label="Booking Type" placeholder="All" options={["room_only", "room_carpark", "carpark_only"]} selected={bookingTypeFilter} onApply={(v) => { setBookingTypeFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={(v) => { setBuildingFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={(v) => { setLocationFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Payment" placeholder="All" options={paymentOptions} selected={paymentFilter} onApply={(v) => { setPaymentFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date From</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date To</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
                <SortableTableHead sortKey="room_title" currentSort={sort} onSort={handleSort}>Room Title</SortableTableHead>
                <SortableTableHead sortKey="booking_type" currentSort={sort} onSort={handleSort}>Booking Type</SortableTableHead>
                <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Created</SortableTableHead>
                <SortableTableHead sortKey="updated_at" currentSort={sort} onSort={handleSort}>Updated</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No move-ins found</TableCell></TableRow>
              ) : paged.map((item) => {
                const room = getRoom(item.room_id);
                const booking = getBooking(item.booking_id);
                const blocked = isMoveInBlocked(item);
                return (
                  <TableRow key={item.id} className={blocked ? "opacity-50" : ""}>
                    <TableCell>{item.room?.building || "—"}</TableCell>
                    <TableCell>{item.room?.unit || "—"}</TableCell>
                    <TableCell>{item.room?.room || "—"}</TableCell>
                    <TableCell className="text-sm">{room?.room_title || "—"}</TableCell>
                    <TableCell className="text-sm">{booking ? BOOKING_TYPE_LABELS[(booking.booking_type || "room_only") as BookingType] : "—"}</TableCell>
                    <TableCell className="font-medium">{item.tenant_name}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-sm">{getAgentName(item.agent_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(item.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(item.updated_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewItem(item)} title="View"><Eye className="h-4 w-4" /></Button>
                        {/* Agent can edit/submit if ready_for_move_in or rejected, and not blocked */}
                        {(item.status === "ready_for_move_in" || item.status === "rejected" || item.status === "submitted") && !blocked && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit/Submit"><Pencil className="h-4 w-4" /></Button>
                        )}
                        {/* Admin actions */}
                        {isAdmin && item.status === "submitted" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setShowApproveDialog(item)} title="Approve"><Check className="h-4 w-4 text-primary" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setShowRejectDialog(item)} title="Reject"><X className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                        {isAdmin && item.status === "approved" && (
                          <Button variant="ghost" size="icon" onClick={() => setShowReverseDialog(item)} title="Reverse"><RotateCcw className="h-4 w-4 text-orange-500" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
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
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

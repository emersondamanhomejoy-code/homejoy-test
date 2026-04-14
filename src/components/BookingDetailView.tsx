import { useState, useMemo } from "react";
import { Booking, useUpdateBookingStatus, BOOKING_TYPE_LABELS, BookingType } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { useMoveIns } from "@/hooks/useMoveIns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StandardModal } from "@/components/ui/standard-modal";
import { FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getAgentName: (id: string | null) => string;
}

export function BookingDetailView({ booking: b, open, onOpenChange, getAgentName }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateBookingStatus = useUpdateBookingStatus();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const { data: moveInsData = [] } = useMoveIns();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelResolutionType, setCancelResolutionType] = useState("");

  const room = roomsData.find(r => r.id === b.room_id);
  const info = b.room || (room ? { room: room.room, building: room.building, unit: room.unit } : null);
  const unitCfg = room ? unitsData.find(u => u.id === room.unit_id) : null;
  const moveInCost = b.move_in_cost as any;

  // Find related move-in record
  const relatedMoveIn = useMemo(() => {
    return moveInsData.find(m => m.booking_id === b.id);
  }, [moveInsData, b.id]);

  // Derive move-in status display
  const moveInStatusDisplay = useMemo(() => {
    if (b.status === "rejected") return "Not Proceeded";
    if (b.status === "cancelled") {
      // If move-in is closed or doesn't exist, show "Not Proceeded"
      if (!relatedMoveIn || relatedMoveIn.status === "closed" || relatedMoveIn.status === "rejected") return "Not Proceeded";
    }
    if ((b.status === "approved" || b.status === "cancelled") && relatedMoveIn) {
      const s = relatedMoveIn.status;
      const map: Record<string, string> = {
        ready_for_move_in: "Ready for Move-in",
        submitted: "Submitted",
        approved: "Approved",
        rejected: "Not Proceeded",
        reversed: "Reversed",
        closed: "Not Proceeded",
      };
      return map[s] || s;
    }
    if (b.status === "approved") return "Ready for Move-in";
    return "Pending Booking Review";
  }, [b.status, relatedMoveIn]);

  const carParkSelections: { roomId: string; carPlate: string }[] = useMemo(() => {
    const docs = b.documents as any;
    return docs?.carParkSelections || [];
  }, [b.documents]);

  const carParkRooms = useMemo(() => {
    return carParkSelections.map(sel => {
      const cp = roomsData.find(r => r.id === sel.roomId);
      return { ...sel, room: cp };
    });
  }, [carParkSelections, roomsData]);

  const statusBadge = (status: string, variant?: "booking" | "movein") => {
    let cls = "";
    if (variant === "movein") {
      cls = status === "Not Proceeded" ? "bg-gray-500/20 text-gray-500"
        : status === "Ready for Move-in" ? "bg-blue-500/20 text-blue-600"
        : status === "Approved" ? "bg-green-500/20 text-green-600"
        : status === "Submitted" ? "bg-yellow-500/20 text-yellow-600"
        : status === "Closed" ? "bg-orange-500/20 text-orange-600"
        : status === "Pending Booking Review" ? "bg-muted text-muted-foreground"
        : "bg-orange-500/20 text-orange-600";
    } else {
      cls = status === "submitted" ? "bg-yellow-500/20 text-yellow-600"
        : status === "approved" ? "bg-green-500/20 text-green-600"
        : status === "cancelled" ? "bg-gray-500/20 text-gray-500"
        : "bg-red-500/20 text-red-600";
    }
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>{variant === "movein" ? status : status.toUpperCase()}</span>;
  };

  const handleApprove = async () => {
    if (!user) return;
    const carParkIds = carParkSelections.map(s => s.roomId).filter(Boolean);
    const history = [...(b.history || []), { action: "approved", by: user.email, at: new Date().toISOString() }];
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "approved", reviewed_by: user.id,
      room_id: b.room_id, tenant_name: b.tenant_name,
      tenant_gender: b.tenant_gender, tenant_race: b.tenant_race,
      tenant_nationality: b.tenant_nationality,
      pax_staying: b.pax_staying, carParkIds, history,
      booking_type: (b.booking_type || "room_only") as BookingType,
      bookingData: b,
    });
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "approve_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, room: info ? `${info.building} ${info.unit} ${info.room}` : "" },
    });
    toast.success("Booking approved — Move-in record created");
    setShowApproveDialog(false);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!user || !rejectReason.trim()) { toast.error("Please enter a reject reason"); return; }
    const carParkIds = carParkSelections.map(s => s.roomId).filter(Boolean);
    const history = [...(b.history || []), { action: "rejected", by: user.email, at: new Date().toISOString(), reason: rejectReason }];
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason,
      room_id: b.room_id, carParkIds, history,
    });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "reject_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, reason: rejectReason },
    });
    toast.success("Booking rejected");
    setShowRejectDialog(false);
    onOpenChange(false);
  };

  const handleCancel = async () => {
    if (!user || !cancelReason.trim()) { toast.error("Cancel reason is required"); return; }
    if (!cancelResolutionType) { toast.error("Please select a resolution type"); return; }
    const carParkIds = carParkSelections.map(s => s.roomId).filter(Boolean);
    const history = [...(b.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason: cancelReason, resolution_type: cancelResolutionType }];
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: cancelReason,
      room_id: b.room_id, carParkIds, history,
      resolution_type: cancelResolutionType,
    });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "cancel_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, reason: cancelReason, resolution_type: cancelResolutionType },
    });
    toast.success(`Booking cancelled (${cancelResolutionType})`);
    setShowCancelDialog(false);
    setCancelResolutionType("");
    onOpenChange(false);
  };

  const handleResubmit = async () => {
    if (!user) return;
    const history = [...(b.history || []), { action: "resubmitted", by: user.email, at: new Date().toISOString() }];
    const { error } = await supabase
      .from("bookings")
      .update({ status: "submitted", reject_reason: "", reviewed_by: null, reviewed_at: null, history, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) { toast.error("Failed to resubmit"); return; }
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "resubmit_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name },
    });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    toast.success("Booking resubmitted");
    onOpenChange(false);
  };

  const docSection = (label: string, paths: any) => {
    const arr = Array.isArray(paths) ? paths : [];
    if (arr.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase">{label}</div>
        <div className="flex flex-wrap gap-2">
          {arr.map((p: string, i: number) => (
            <a key={i} href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/booking-docs/${p}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline">
              <FileText className="h-3 w-3" /> {p.split("/").pop()} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    );
  };

  const sectionCard = (title: string, children: React.ReactNode) => (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="text-sm font-bold flex items-center gap-2 border-b border-border pb-2 uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );

  const accessFees: { label: string; unitPrice: number; qty: number; total: number }[] = moveInCost?.accessFees || [];
  const carparkFees: { label: string; unitPrice: number; qty: number; total: number }[] = moveInCost?.carparkFees || [];
  const carparkRental = moveInCost?.carparkRental || 0;

  // Footer actions based on status
  const footerActions = () => {
    if (b.status === "submitted") {
      return (
        <>
          <Button variant="outline" className="text-muted-foreground" onClick={() => setShowCancelDialog(true)}>Cancel</Button>
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>Reject</Button>
          <Button onClick={() => setShowApproveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
        </>
      );
    }
    if (b.status === "rejected") {
      return (
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={handleResubmit}>Resubmit</Button>
        </>
      );
    }
    if (b.status === "approved") {
      // Only show terminate if move-in is NOT yet approved
      const moveInAlreadyApproved = relatedMoveIn?.status === "approved";
      if (moveInAlreadyApproved) return null;
      return (
        <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>Terminate Booking</Button>
      );
    }
    return null; // cancelled — close only
  };

  return (
    <>
      <StandardModal
        open={open}
        onOpenChange={onOpenChange}
        title="View Booking"
        size="lg"
        footer={footerActions()}
      >
        <div className="space-y-4">

          {/* SECTION A – Booking Status Summary */}
          {sectionCard("Booking Status Summary", (
            <div>
              {infoRow("Booking ID", <span className="font-mono text-xs">{b.id.slice(0, 8)}…</span>)}
              {infoRow("Booking Type", BOOKING_TYPE_LABELS[(b.booking_type || "room_only") as BookingType])}
              {infoRow("Booking Status", statusBadge(b.status))}
              {infoRow("Move-in Status", statusBadge(moveInStatusDisplay, "movein"))}
              {b.resolution_type && infoRow("Resolution Type", <span className="font-semibold capitalize">{b.resolution_type}</span>)}
              {infoRow("Submitted At", format(new Date(b.created_at), "dd MMM yyyy, HH:mm"))}
              {infoRow("Agent", getAgentName(b.submitted_by))}
              {b.reviewed_at && infoRow("Reviewed At", format(new Date(b.reviewed_at), "dd MMM yyyy, HH:mm"))}
              {b.reviewed_by && infoRow("Reviewed By", getAgentName(b.reviewed_by))}

              {/* Reason callout */}
              {b.status === "rejected" && b.reject_reason && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm mt-2">
                  <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
                </div>
              )}
              {b.status === "cancelled" && b.reject_reason && (
                <div className="bg-muted text-muted-foreground rounded-lg p-3 text-sm mt-2">
                  <span className="font-semibold">Cancel Reason:</span> {b.reject_reason}
                </div>
              )}
            </div>
          ))}

          {/* SECTION B – Room & Parking Summary */}
          {sectionCard("Room & Parking Summary", (
            <div>
              {infoRow("Building", info?.building)}
              {infoRow("Unit", info?.unit)}
              {infoRow("Room", info?.room)}
              {infoRow("Room Title", room?.room_title)}
              {infoRow("Room Status", room?.status)}
              {infoRow("Exact Rental", `RM ${moveInCost?.advance || room?.rent || 0}`)}
              {infoRow("Pax Staying", b.pax_staying)}
              {infoRow("Tenancy Duration", `${b.contract_months} months`)}
              {infoRow("Move-in Date", b.move_in_date)}

              {carParkRooms.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Parking</div>
                  {carParkRooms.map((cp, i) => (
                    <div key={i} className="bg-background rounded-lg border p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold">Parking {i + 1}: {cp.room?.room || "—"}</span>
                        <span>RM {cp.room?.rent || 0}/mo</span>
                      </div>
                      <div className="text-muted-foreground">Car Plate: {cp.carPlate || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* SECTION C – Tenant Profile */}
          {sectionCard("Tenant Profile", (
            <div className="grid md:grid-cols-2 gap-x-8">
              <div>
                {infoRow("Full Name", b.tenant_name)}
                {infoRow("NRIC/Passport", b.tenant_ic_passport)}
                {infoRow("Email", b.tenant_email)}
                {infoRow("Contact No", b.tenant_phone)}
              </div>
              <div>
                {infoRow("Gender", b.tenant_gender)}
                {infoRow("Nationality", b.tenant_nationality)}
                {infoRow("Occupation", b.occupation)}
              </div>
            </div>
          ))}

          {/* Second tenant if exists */}
          {(() => {
            const docs = b.documents as any;
            const t2 = docs?.tenant2;
            if (!t2?.name) return null;
            return sectionCard("Second Tenant", (
              <div className="grid md:grid-cols-2 gap-x-8">
                <div>
                  {infoRow("Full Name", t2.name)}
                  {infoRow("NRIC/Passport", t2.icPassport)}
                  {infoRow("Email", t2.email)}
                </div>
                <div>
                  {infoRow("Contact No", t2.phone)}
                  {infoRow("Nationality", t2.nationality)}
                  {infoRow("Occupation", t2.occupation)}
                </div>
              </div>
            ));
          })()}

          {/* SECTION D – Emergency Contacts */}
          {sectionCard("Emergency Contacts", (
            <div className="grid md:grid-cols-2 gap-x-8">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Contact 1</div>
                {infoRow("Name", b.emergency_1_name || b.emergency_name)}
                {infoRow("Phone", b.emergency_1_phone || b.emergency_phone)}
                {infoRow("Relationship", b.emergency_1_relationship || b.emergency_relationship)}
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Contact 2</div>
                {infoRow("Name", b.emergency_2_name)}
                {infoRow("Phone", b.emergency_2_phone)}
                {infoRow("Relationship", b.emergency_2_relationship)}
              </div>
            </div>
          ))}

          {/* SECTION E – Booking Fee Receipt */}
          {sectionCard("Booking Fee Receipt", (
            <div className="space-y-3">
              {docSection("Booking Fee Receipt", b.doc_transfer_slip)}
              {!b.doc_transfer_slip?.length && (
                <div className="text-sm text-muted-foreground">No receipt uploaded</div>
              )}
            </div>
          ))}

          {/* SECTION F – Move-in Cost Breakdown */}
          {moveInCost && sectionCard("Move-in Cost Breakdown", (
            <div className="bg-background rounded-lg border divide-y divide-border">
              <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                <span>Description</span>
                <span className="text-right">Amount (RM)</span>
              </div>

              {moveInCost.advance != null && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>1 Month Advance Rental</span>
                  <span className="text-right font-medium">{Number(moveInCost.advance).toLocaleString()}</span>
                </div>
              )}

              {moveInCost.deposit != null && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>Rental Deposit {unitCfg ? `(×${unitCfg.deposit_multiplier})` : ""}</span>
                  <span className="text-right font-medium">{Number(moveInCost.deposit).toLocaleString()}</span>
                </div>
              )}

              {moveInCost.adminFee != null && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>Admin Fee</span>
                  <span className="text-right font-medium">{Number(moveInCost.adminFee).toLocaleString()}</span>
                </div>
              )}

              {accessFees.map((f, i) => (
                <div key={`access-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                  <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                </div>
              ))}

              {carparkFees.filter(f => f.qty > 0 && f.total > 0).map((f, i) => (
                <div key={`cp-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                  <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                </div>
              ))}

              {carparkRental > 0 && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>1 Month Advance Car Park Rental</span>
                  <span className="text-right font-medium">{carparkRental.toLocaleString()}</span>
                </div>
              )}

              {moveInCost.accessCardDeposit > 0 && !accessFees.length && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>Access Card Deposit</span>
                  <span className="text-right font-medium">{Number(moveInCost.accessCardDeposit).toLocaleString()}</span>
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto] px-4 py-3 bg-primary/5">
                <span className="font-bold">Total Move-in Cost</span>
                <span className="text-right font-bold text-lg">RM {Number(moveInCost.total || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {/* SECTION G – History */}
          {(b.history || []).length > 0 && sectionCard("History", (
            <div className="space-y-2">
              {(b.history || []).map((h: any, i: number) => (
                <div key={i} className="rounded-lg border bg-background p-3 text-xs">
                  <span className="font-semibold capitalize">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}
                  {h.reason && <div className="mt-1 text-muted-foreground">Reason: {h.reason}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </StandardModal>

      {/* Approve Confirm Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this booking for <strong>{b.tenant_name}</strong>?
              Room/carpark will be marked as <strong>Pending</strong>, a Move-in record will be auto-created, and a tenant record will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              Yes, Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(false); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {b.status === "approved" 
                ? "This will cancel the booking, close the related move-in record, and release all pending room/carpark holds."
                : "Please provide a resolution type and reason for cancelling this booking."}
            </p>
            <Textarea placeholder="Enter reject reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Reject Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(false); setCancelReason(""); setCancelResolutionType(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{b.status === "approved" ? "Terminate Approved Booking" : "Cancel Booking"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Resolution Type *</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={cancelResolutionType} onChange={e => setCancelResolutionType(e.target.value)}>
                <option value="">— Select —</option>
                <option value="forfeit">Forfeit</option>
                <option value="tenant_withdrawn">Tenant Withdrawn</option>
                <option value="admin_error">Admin Error</option>
                <option value="wrong_room">Wrong Room</option>
                <option value="duplicate">Duplicate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason *</label>
              <Textarea placeholder="Enter cancel reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelReason(""); setCancelResolutionType(""); }}>Go Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim() || !cancelResolutionType}>
              {b.status === "approved" ? "Terminate Booking" : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

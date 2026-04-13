import { useState, useMemo } from "react";
import { Booking, useUpdateBookingStatus, BOOKING_TYPE_LABELS, BookingType } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
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
  const { data: condosData = [] } = useCondos();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const room = roomsData.find(r => r.id === b.room_id);
  const info = b.room || (room ? { room: room.room, building: room.building, unit: room.unit } : null);
  const unitCfg = room ? unitsData.find(u => u.id === room.unit_id) : null;

  const moveInCost = b.move_in_cost as any;

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

  const statusBadge = (status: string) => {
    const cls = status === "submitted" ? "bg-yellow-500/20 text-yellow-600"
      : status === "approved" ? "bg-green-500/20 text-green-600"
        : status === "cancelled" ? "bg-gray-500/20 text-gray-500"
          : "bg-red-500/20 text-red-600";
    return <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${cls}`}>{status.toUpperCase()}</span>;
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
    const history = [...(b.history || []), { action: "rejected", by: user.email, at: new Date().toISOString(), reason: rejectReason }];
    await updateBookingStatus.mutateAsync({ id: b.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason, history });
    if (b.room_id) {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
    }
    for (const sel of carParkSelections) {
      if (sel.roomId) await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", sel.roomId);
    }
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
    const carParkIds = carParkSelections.map(s => s.roomId).filter(Boolean);
    const history = [...(b.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason: cancelReason }];
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: cancelReason,
      room_id: b.room_id, carParkIds, history,
      resolution_type: b.status === "approved" ? "forfeit" : "",
    });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "cancel_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, reason: cancelReason, resolution_type: b.status === "approved" ? "forfeit" : "" },
    });
    toast.success(b.status === "approved" ? "Booking cancelled (Forfeit)" : "Booking cancelled");
    setShowCancelDialog(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    if (b.room_id && b.status === "submitted") {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
    }
    for (const sel of carParkSelections) {
      if (sel.roomId) await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", sel.roomId);
    }
    await supabase.from("bookings").delete().eq("id", b.id);
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "delete_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name },
    });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    toast.success("Booking deleted");
    setShowDeleteDialog(false);
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

  const accessFees: { label: string; unitPrice: number; qty: number; total: number }[] = moveInCost?.accessFees || [];
  const carparkFees: { label: string; unitPrice: number; qty: number; total: number }[] = moveInCost?.carparkFees || [];
  const carparkRental = moveInCost?.carparkRental || 0;

  // Build footer actions
  const footerActions = () => {
    if (b.status === "submitted") {
      return (
        <>
          <Button variant="outline" className="text-muted-foreground" onClick={() => setShowCancelDialog(true)}>🚫 Cancel</Button>
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>❌ Reject</Button>
          <Button onClick={() => setShowApproveDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">✅ Approve</Button>
        </>
      );
    }
    if (b.status === "approved") {
      return <Button variant="outline" className="text-muted-foreground" onClick={() => setShowCancelDialog(true)}>🚫 Cancel Booking</Button>;
    }
    if (b.status === "rejected" || b.status === "cancelled") {
      return <Button variant="outline" className="text-destructive" onClick={() => setShowDeleteDialog(true)}>🗑️ Delete</Button>;
    }
    return null;
  };

  return (
    <>
      <StandardModal
        open={open}
        onOpenChange={onOpenChange}
        title="View Booking"
        size="lg"
        hideCancel
        footer={footerActions()}
      >
        <div className="space-y-5">

          {/* 1. Booking Summary */}
          {sectionCard("📋", "Booking Summary", (
            <div>
              {infoRow("Booking ID", <span className="font-mono text-xs">{b.id}</span>)}
              {infoRow("Booking Type", BOOKING_TYPE_LABELS[(b.booking_type || "room_only") as BookingType])}
              {infoRow("Status", statusBadge(b.status))}
              {b.resolution_type && infoRow("Resolution", <span className="font-semibold capitalize">{b.resolution_type}</span>)}
              {infoRow("Submitted At", format(new Date(b.created_at), "dd MMM yyyy, HH:mm"))}
              {infoRow("Agent", getAgentName(b.submitted_by))}
              {b.reviewed_at && infoRow("Reviewed At", format(new Date(b.reviewed_at), "dd MMM yyyy, HH:mm"))}
            </div>
          ))}

          {/* 2. Room Summary */}
          {sectionCard("🏠", "Room Summary", (
            <div>
              {infoRow("Building", info?.building)}
              {infoRow("Unit", info?.unit)}
              {infoRow("Room", info?.room)}
              {infoRow("Room Status", room?.status)}
              {infoRow("Exact Rental", `RM${moveInCost?.advance || b.monthly_salary || 0}`)}
              {infoRow("Pax Staying", b.pax_staying)}
              {infoRow("Tenancy Duration", `${b.contract_months} months`)}
              {infoRow("Move-in Date", b.move_in_date)}
            </div>
          ))}

          {/* 3. Parking */}
          {carParkRooms.length > 0 && sectionCard("🅿️", "Parking", (
            <div className="space-y-2">
              {carParkRooms.map((cp, i) => (
                <div key={i} className="bg-background rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">Parking {i + 1}: {cp.room?.room || "—"}</span>
                    <span>RM{cp.room?.rent || 0}/mo</span>
                  </div>
                  <div className="text-muted-foreground">Car Plate: {cp.carPlate || "—"}</div>
                </div>
              ))}
            </div>
          ))}

          {/* 4. Tenant Profile */}
          {sectionCard("👤", "Tenant Profile", (
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
            return sectionCard("👥", "Second Tenant", (
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

          {/* 5. Emergency Contacts */}
          {sectionCard("🚨", "Emergency Contacts", (
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

          {/* 6. Cost Breakdown */}
          {moveInCost && sectionCard("💰", "Move-in Cost", (
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

          {/* 7. Uploaded Documents */}
          {sectionCard("📎", "Uploaded Documents", (
            <div className="space-y-3">
              {docSection("Passport / IC", b.doc_passport)}
              {docSection("Offer Letter", b.doc_offer_letter)}
              {docSection("Transfer Slip", b.doc_transfer_slip)}
              {!b.doc_passport?.length && !b.doc_offer_letter?.length && !b.doc_transfer_slip?.length && (
                <div className="text-sm text-muted-foreground">No documents uploaded</div>
              )}
            </div>
          ))}

          {/* Reject / Cancel reason display */}
          {b.status === "rejected" && b.reject_reason && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
              <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
            </div>
          )}
          {b.status === "cancelled" && b.reject_reason && (
            <div className="bg-muted text-muted-foreground rounded-lg p-4 text-sm">
              <span className="font-semibold">Cancel Reason:</span> {b.reject_reason}
            </div>
          )}

          {/* History Log */}
          {(b.history || []).length > 0 && (
            <div className="bg-card rounded-lg border p-5 space-y-3">
              <div className="text-base font-bold border-b border-border pb-2">📜 History</div>
              <div className="space-y-2">
                {(b.history || []).map((h: any, i: number) => (
                  <div key={i} className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <span className="font-semibold capitalize">{h.action}</span> by {h.by} — {h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}
                    {h.reason && <div className="mt-1 text-muted-foreground">Reason: {h.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <p className="text-sm text-muted-foreground">Please enter the reason for rejecting this booking. This is required.</p>
            <Textarea placeholder="Enter reject reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(false); setCancelReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Please enter the reason for cancelling this booking. This is required.</p>
            <Textarea placeholder="Enter cancel reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelReason(""); }}>Go Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim()}>
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The booking record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

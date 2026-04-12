import { useState } from "react";
import { Booking, useUpdateBookingStatus } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  booking: Booking;
  onBack: () => void;
  onEdit: (b: Booking) => void;
  getAgentName: (id: string | null) => string;
}

export function BookingDetailView({ booking: b, onBack, onEdit, getAgentName }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateBookingStatus = useUpdateBookingStatus();
  const { data: roomsData = [] } = useRooms();

  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const room = roomsData.find(r => r.id === b.room_id);
  const info = b.room || (room ? { room: room.room, building: room.building, unit: room.unit } : null);
  const moveInCost = b.move_in_cost as Record<string, number> | null;

  const statusBadge = (status: string) => {
    const cls = status === "pending"
      ? "bg-yellow-500/20 text-yellow-600"
      : status === "approved"
        ? "bg-green-500/20 text-green-600"
        : status === "cancelled"
          ? "bg-gray-500/20 text-gray-500"
          : "bg-red-500/20 text-red-600";
    return <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${cls}`}>{status.toUpperCase()}</span>;
  };

  const handleApprove = async () => {
    if (!user) return;
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "approved", reviewed_by: user.id,
      room_id: b.room_id, tenant_name: b.tenant_name,
      tenant_gender: b.tenant_gender, tenant_race: b.tenant_race,
      pax_staying: b.pax_staying,
    });
    // Log activity
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "approve_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, room: info ? `${info.building} ${info.unit} ${info.room}` : "" },
    });
    toast.success("Booking approved");
    onBack();
  };

  const handleReject = async () => {
    if (!user || !rejectReason.trim()) { toast.error("Please enter a reject reason"); return; }
    await updateBookingStatus.mutateAsync({ id: b.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason });
    if (b.room_id) {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "reject_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, reason: rejectReason },
    });
    toast.success("Booking rejected");
    onBack();
  };

  const handleCancel = async () => {
    if (!user || !cancelReason.trim()) { toast.error("Cancel reason is required"); return; }
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: cancelReason,
    });
    if (b.room_id) {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
    await supabase.from("activity_logs").insert({
      actor_id: user.id, actor_email: user.email || "",
      action: "cancel_booking", entity_type: "booking", entity_id: b.id,
      details: { tenant_name: b.tenant_name, reason: cancelReason },
    });
    toast.success("Booking cancelled");
    setShowCancelDialog(false);
    onBack();
  };

  const handleDelete = async () => {
    if (!user) return;
    if (b.room_id && b.status === "pending") {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
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
    onBack();
  };

  const canEdit = b.status === "pending" || b.status === "rejected";

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
    <div className="bg-card rounded-lg border p-5 space-y-3">
      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</div>
      {children}
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Bookings
        </button>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => onEdit(b)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit Booking
            </Button>
          )}
        </div>
      </div>

      {/* 1. Booking Summary */}
      {sectionCard("Booking Summary", (
        <div>
          {infoRow("Booking ID", <span className="font-mono text-xs">{b.id}</span>)}
          {infoRow("Status", statusBadge(b.status))}
          {infoRow("Submitted At", format(new Date(b.created_at), "dd MMM yyyy, HH:mm"))}
          {infoRow("Agent", getAgentName(b.submitted_by))}
          {b.reviewed_at && infoRow("Reviewed At", format(new Date(b.reviewed_at), "dd MMM yyyy, HH:mm"))}
        </div>
      ))}

      {/* 2. Room Summary */}
      {sectionCard("Room Summary", (
        <div>
          {infoRow("Building", info?.building)}
          {infoRow("Unit", info?.unit)}
          {infoRow("Room", info?.room)}
          {infoRow("Room Status", room?.status)}
          {infoRow("Final Rental", `RM${b.monthly_salary || 0}`)}
        </div>
      ))}

      {/* 3. Tenant Profile Summary */}
      {sectionCard("Tenant Profile", (
        <div className="grid md:grid-cols-2 gap-x-8">
          <div>
            {infoRow("Tenant Name", b.tenant_name)}
            {infoRow("Phone", b.tenant_phone)}
            {infoRow("Email", b.tenant_email)}
            {infoRow("IC/Passport", b.tenant_ic_passport)}
            {infoRow("Nationality", b.tenant_nationality)}
            {infoRow("Gender", b.tenant_gender)}
            {infoRow("Race", b.tenant_race)}
          </div>
          <div>
            {infoRow("Pax Staying", b.pax_staying)}
            {infoRow("Occupation", b.occupation)}
            {infoRow("Company", b.company)}
            {infoRow("Position", b.position)}
            {infoRow("Move-in Date", b.move_in_date)}
            {infoRow("Contract", `${b.contract_months} months`)}
            {infoRow("Access Cards", b.access_card_count)}
            {infoRow("Parking", `${b.parking || "0"} ${b.car_plate ? `(${b.car_plate})` : ""}`)}
          </div>
        </div>
      ))}

      {/* Emergency Contacts */}
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

      {/* 4. Cost Breakdown */}
      {moveInCost && Object.keys(moveInCost).length > 0 && sectionCard("Cost Breakdown", (
        <div className="max-w-md">
          {moveInCost.advance != null && infoRow("1 Month Advance Rental", `RM${moveInCost.advance}`)}
          {moveInCost.deposit != null && infoRow("Rental Deposit", `RM${moveInCost.deposit}`)}
          {moveInCost.adminFee != null && infoRow("Admin Fee", `RM${moveInCost.adminFee}`)}
          {moveInCost.accessCardDeposit != null && infoRow("Access Card Deposit", `RM${moveInCost.accessCardDeposit}`)}
          {moveInCost.electricityReload != null && infoRow("Electricity Reload", `RM${moveInCost.electricityReload}`)}
          <div className="flex justify-between text-sm py-2 border-t border-border mt-2 font-bold">
            <span>Total</span>
            <span>RM{moveInCost.total}</span>
          </div>
        </div>
      ))}

      {/* 5. Uploaded Documents */}
      {sectionCard("Uploaded Documents", (
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

      {/* Actions */}
      {b.status === "pending" && (
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleApprove} disabled={updateBookingStatus.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              ✅ Approve Booking
            </Button>
            <div className="flex gap-2">
              <Input placeholder="Reject reason (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="flex-1" />
              <Button onClick={handleReject} disabled={updateBookingStatus.isPending} variant="destructive">
                ❌ Reject Booking
              </Button>
            </div>
            <Button variant="outline" className="text-muted-foreground" onClick={() => setShowCancelDialog(true)}>
              🚫 Cancel Booking
            </Button>
          </div>
        </div>
      )}

      {b.status === "approved" && (
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</div>
          <Button variant="outline" className="text-muted-foreground" onClick={() => setShowCancelDialog(true)}>
            🚫 Cancel Booking
          </Button>
        </div>
      )}

      {(b.status === "rejected" || b.status === "cancelled") && (
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</div>
          <Button variant="outline" className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
            🗑️ Delete Booking
          </Button>
        </div>
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ Booking fee is <strong>non-refundable</strong> once paid. This action will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Input placeholder="Cancel reason (required)..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={!cancelReason.trim()}>
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}

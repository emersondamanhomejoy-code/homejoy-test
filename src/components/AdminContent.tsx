import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { MoveInPage } from "@/components/MoveInPage";
import { MoveOutPage } from "@/components/MoveOutPage";
import { UsersPage } from "@/components/UsersPage";
import { ActivityLogPage } from "@/components/ActivityLogPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useUnits, Unit } from "@/hooks/useRooms";
import { useBookings, useUpdateOrderStatus, Booking, ORDER_STATUS_LABELS } from "@/hooks/useBookings";
import { logActivity } from "@/hooks/useActivityLog";
import { UnitsRoomsContent } from "@/components/UnitsRoomsContent";
import { BookingsContent } from "@/components/BookingsContent";
import { inputClass } from "@/lib/ui-constants";
import { StatCard } from "@/components/ui/stat-card";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";
import { StatusBadge } from "@/components/StatusBadge";

function DocFileLink({ path, isImage, label }: { path: string; isImage: boolean; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("booking-docs").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);
  if (!url) return <span className="text-xs text-muted-foreground">Loading...</span>;
  return isImage ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={label} className="h-28 w-auto rounded-lg border object-cover hover:opacity-80 transition-opacity" />
    </a>
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:opacity-80 transition-opacity">
      📎 {label}
    </a>
  );
}

interface AdminContentProps {
  tab: "dashboard" | "units" | "bookings" | "movein" | "moveout" | "users" | "activity";
}

export function AdminContent({ tab }: AdminContentProps) {
  const { user, role } = useAuth();
  const canViewActivityLog = role === "super_admin";

  const { data: units = [] } = useUnits();
  const { data: allBookings = [] } = useBookings();
  const updateOrderStatus = useUpdateOrderStatus();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const adminRejectValidation = useFormValidation();

  return (
    <div className="space-y-6">
      {tab === "dashboard" && (() => {
        const pendingBookings = allBookings.filter(b => b.order_status === "booking_submitted");
        const approvedBookings = allBookings.filter(b => b.order_status === "booking_approved" || b.order_status === "move_in_submitted" || b.order_status === "move_in_approved");
        const rejectedBookings = allBookings.filter(b => b.order_status === "booking_rejected");
        const totalRooms = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type !== "Car Park").length ?? 0), 0);
        const availableRooms = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type !== "Car Park" && r.status === "Available").length ?? 0), 0);
        const occupiedRooms = totalRooms - availableRooms;
        const totalCarParks = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type === "Car Park").length ?? 0), 0);
        const availableCarParks = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type === "Car Park" && r.status === "Available").length ?? 0), 0);

        const handleApprove = async (booking: Booking) => {
          if (!user) return;
          try {
            await updateOrderStatus.mutateAsync({
              id: booking.id,
              order_status: "booking_approved",
              reviewed_by: user.id,
              room_id: booking.room_id,
              tenant_name: booking.tenant_name,
              tenant_gender: booking.tenant_gender,
              tenant_race: booking.tenant_race,
              pax_staying: booking.pax_staying || 1,
              carParkIds: (booking.documents as any)?.carParkIds || [],
              bookingData: booking,
            });
            logActivity("approve_booking", "booking", booking.id, { tenant: booking.tenant_name });
            setSelectedBooking(null);
          } catch (e: any) { toast.error(e.message || "Failed to approve booking"); }
        };

        const handleReject = async (booking: Booking) => {
          const rejectRules = { rejectReason: () => !rejectReason.trim() ? "Reject reason is required" : null };
          if (!user || !adminRejectValidation.validate({ rejectReason }, rejectRules)) return;
          try {
            await updateOrderStatus.mutateAsync({ id: booking.id, order_status: "booking_rejected", reviewed_by: user.id, reject_reason: rejectReason, room_id: booking.room_id, carParkIds: (booking.documents as any)?.carParkIds || [] });
            logActivity("reject_booking", "booking", booking.id, { tenant: booking.tenant_name, reason: rejectReason });
            setSelectedBooking(null);
            setRejectReason("");
          } catch (e: any) { toast.error(e.message || "Failed to reject booking"); }
        };

        if (selectedBooking) {
          const b = selectedBooking;
          return (
            <div className="space-y-4">
              <button onClick={() => setSelectedBooking(null)} className="text-sm text-muted-foreground hover:text-foreground">← Back to Dashboard</button>
              <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold">{b.tenant_name}</div>
                  <StatusBadge status={ORDER_STATUS_LABELS[b.order_status] || b.order_status} />
                </div>
                {b.room && <div className="text-sm text-muted-foreground">{b.room.building} · {b.room.unit} · {b.room.room}</div>}

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
                      <div>👤 {b.emergency_1_name || b.emergency_name || "—"}</div>
                      <div>📞 {b.emergency_1_phone || b.emergency_phone || "—"}</div>
                      <div>🔗 {b.emergency_1_relationship || b.emergency_relationship || "—"}</div>
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Emergency Contact 2</div>
                    <div className="text-sm space-y-1">
                      <div>👤 {b.emergency_2_name || "—"}</div>
                      <div>📞 {b.emergency_2_phone || "—"}</div>
                      <div>🔗 {b.emergency_2_relationship || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div className="space-y-3 pt-2">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Documents</div>
                  {[
                    { label: "🪪 Passport / IC", files: b.doc_passport as string[] | undefined },
                    { label: "📄 Offer Letter", files: b.doc_offer_letter as string[] | undefined },
                    { label: "🧾 Transfer Slip", files: b.doc_transfer_slip as string[] | undefined },
                  ].map(({ label, files }) => (
                    <div key={label}>
                      <div className="text-sm font-medium mb-1">{label}</div>
                      {files && files.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {files.map((path: string, i: number) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
                            return <DocFileLink key={i} path={path} isImage={isImage} label={`File ${i + 1}`} />;
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No files uploaded</div>
                      )}
                    </div>
                  ))}
                </div>

                {b.order_status === "booking_submitted" && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-border">
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(b)} disabled={updateOrderStatus.isPending} className="px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">✅ Approve</button>
                    </div>
                    <div className="flex gap-2" data-field="rejectReason">
                      <input className={fieldClass(inputClass + " flex-1", !!adminRejectValidation.errors.rejectReason)} placeholder="Reject reason..." value={rejectReason} onChange={e => { setRejectReason(e.target.value); adminRejectValidation.clearError("rejectReason"); }} />
                      <button onClick={() => handleReject(b)} disabled={updateOrderStatus.isPending} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50">❌ Reject</button>
                    </div>
                    <FieldError error={adminRejectValidation.errors.rejectReason} />
                  </div>
                )}

                {b.order_status === "booking_rejected" && b.reject_reason && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Total Rooms" value={totalRooms} />
              <StatCard label="Available Rooms" value={availableRooms} valueColor="text-emerald-600" />
              <StatCard label="Occupied Rooms" value={occupiedRooms} valueColor="text-orange-500" />
              <StatCard label="Available Car Parks" value={<>{availableCarParks} <span className="text-muted-foreground font-normal text-sm">/ {totalCarParks}</span></>} valueColor="text-blue-500" />
              <StatCard label="Pending Bookings" value={pendingBookings.length} valueColor="text-yellow-500" />
            </div>

            <div>
              <div className="text-lg font-bold mb-3">🔔 Pending Bookings</div>
              {pendingBookings.length === 0 ? (
                <div className="bg-card rounded-lg p-6 text-center text-muted-foreground text-sm">No pending bookings</div>
              ) : (
                <div className="space-y-2">
                  {pendingBookings.map(b => (
                    <button key={b.id} onClick={() => setSelectedBooking(b)} className="w-full text-left bg-card rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{b.tenant_name}</div>
                        <div className="text-xs text-muted-foreground">{b.room?.building} · {b.room?.unit} · {b.room?.room} · Move-in: {b.move_in_date}</div>
                      </div>
                      <StatusBadge status="Booking Submitted" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(approvedBookings.length > 0 || rejectedBookings.length > 0) && (
              <div>
                <div className="text-lg font-bold mb-3">📋 Recent Bookings</div>
                <div className="space-y-2">
                  {[...approvedBookings, ...rejectedBookings].slice(0, 10).map(b => (
                    <button key={b.id} onClick={() => setSelectedBooking(b)} className="w-full text-left bg-card rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{b.tenant_name}</div>
                        <div className="text-xs text-muted-foreground">{b.room?.building} · {b.room?.unit} · {b.room?.room}</div>
                      </div>
                      <StatusBadge status={ORDER_STATUS_LABELS[b.order_status] || b.order_status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {tab === "units" && <UnitsRoomsContent />}
      {tab === "bookings" && <BookingsContent />}
      {tab === "movein" && <MoveInPage />}
      {tab === "moveout" && <MoveOutPage />}
      {tab === "users" && <UsersPage />}
      {tab === "activity" && canViewActivityLog && <ActivityLogPage />}
    </div>
  );
}

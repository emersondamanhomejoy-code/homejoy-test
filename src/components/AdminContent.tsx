import { useState, useEffect, useRef } from "react";
import { MoveInPage } from "@/components/MoveInPage";
import { MoveOutPage } from "@/components/MoveOutPage";
import { UsersPage } from "@/components/UsersPage";
import { ActivityLogPage } from "@/components/ActivityLogPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useUnits, Unit } from "@/hooks/useRooms";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { logActivity } from "@/hooks/useActivityLog";
import { UnitsRoomsContent } from "@/components/UnitsRoomsContent";
import { BookingsContent } from "@/components/BookingsContent";
import { inputClass } from "@/lib/ui-constants";

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
  tab: "dashboard" | "units" | "bookings" | "movein" | "users" | "activity";
}

export function AdminContent({ tab }: AdminContentProps) {
  const { user, role } = useAuth();
  const canViewActivityLog = role === "super_admin";

  // Units for dashboard stats
  const { data: units = [] } = useUnits();

  // Bookings state
  const { data: allBookings = [] } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="space-y-6">
      {tab === "dashboard" && (() => {
        const pendingBookings = allBookings.filter(b => b.status === "submitted");
        const approvedBookings = allBookings.filter(b => b.status === "approved");
        const rejectedBookings = allBookings.filter(b => b.status === "rejected");
        const totalRooms = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type !== "Car Park").length ?? 0), 0);
        const availableRooms = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type !== "Car Park" && r.status === "Available").length ?? 0), 0);
        const occupiedRooms = totalRooms - availableRooms;
        const totalCarParks = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type === "Car Park").length ?? 0), 0);
        const availableCarParks = units.reduce((sum, u) => sum + (u.rooms?.filter(r => r.room_type === "Car Park" && r.status === "Available").length ?? 0), 0);

        const handleApprove = async (booking: Booking) => {
          if (!user) return;
          try {
            await updateBookingStatus.mutateAsync({
              id: booking.id,
              status: "approved",
              reviewed_by: user.id,
              room_id: booking.room_id,
              tenant_name: booking.tenant_name,
              tenant_gender: booking.tenant_gender,
              tenant_race: booking.tenant_race,
              pax_staying: (booking as any).pax_staying || 1,
              carParkIds: ((booking as any).documents as any)?.carParkIds || [],
            });
            logActivity("approve_booking", "booking", booking.id, { tenant: booking.tenant_name });
            setSelectedBooking(null);
          } catch (e: any) { alert(e.message); }
        };

        const handleReject = async (booking: Booking) => {
          if (!user || !rejectReason.trim()) { alert("Please enter a reject reason"); return; }
          try {
            await updateBookingStatus.mutateAsync({ id: booking.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason, carParkIds: ((booking as any).documents as any)?.carParkIds || [] });
            logActivity("reject_booking", "booking", booking.id, { tenant: booking.tenant_name, reason: rejectReason });
            setSelectedBooking(null);
            setRejectReason("");
          } catch (e: any) { alert(e.message); }
        };

        if (selectedBooking) {
          const b = selectedBooking;
          return (
            <div className="space-y-4">
              <button onClick={() => setSelectedBooking(null)} className="text-sm text-muted-foreground hover:text-foreground">← Back to Dashboard</button>
              <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold">{b.tenant_name}</div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${b.status === "submitted" ? "bg-yellow-500/20 text-yellow-600" : b.status === "approved" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>{b.status.toUpperCase()}</span>
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
                      <div>💼 {(b as any).occupation || b.company || "—"}</div>
                      <div>💰 RM{b.monthly_salary || "—"}/month</div>
                      <div>👥 Pax: {(b as any).pax_staying || "—"}</div>
                      <div>🪪 Access Cards: {(b as any).access_card_count || 0}</div>
                      <div>🅿️ Parking: {(b as any).parking || "0"} {(b as any).car_plate ? `(${(b as any).car_plate})` : ""}</div>
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Emergency Contact 1</div>
                    <div className="text-sm space-y-1">
                      <div>👤 {(b as any).emergency_1_name || b.emergency_name || "—"}</div>
                      <div>📞 {(b as any).emergency_1_phone || b.emergency_phone || "—"}</div>
                      <div>🔗 {(b as any).emergency_1_relationship || b.emergency_relationship || "—"}</div>
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Emergency Contact 2</div>
                    <div className="text-sm space-y-1">
                      <div>👤 {(b as any).emergency_2_name || "—"}</div>
                      <div>📞 {(b as any).emergency_2_phone || "—"}</div>
                      <div>🔗 {(b as any).emergency_2_relationship || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div className="space-y-3 pt-2">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Documents</div>
                  {[
                    { label: "🪪 Passport / IC", files: (b as any).doc_passport as string[] | undefined },
                    { label: "📄 Offer Letter", files: (b as any).doc_offer_letter as string[] | undefined },
                    { label: "🧾 Transfer Slip", files: (b as any).doc_transfer_slip as string[] | undefined },
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

                {b.status === "submitted" && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-border">
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(b)} disabled={updateBookingStatus.isPending} className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">✅ Approve</button>
                    </div>
                    <div className="flex gap-2">
                      <input className={inputClass + " flex-1"} placeholder="Reject reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                      <button onClick={() => handleReject(b)} disabled={updateBookingStatus.isPending} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">❌ Reject</button>
                    </div>
                  </div>
                )}

                {b.status === "rejected" && b.reject_reason && (
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
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold">{totalRooms}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Rooms</div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-600">{availableRooms}</div>
                <div className="text-xs text-muted-foreground mt-1">Available Rooms</div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-orange-500">{occupiedRooms}</div>
                <div className="text-xs text-muted-foreground mt-1">Occupied Rooms</div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-blue-500">{availableCarParks} / {totalCarParks}</div>
                <div className="text-xs text-muted-foreground mt-1">Available Car Parks</div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-yellow-500">{pendingBookings.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Pending Bookings</div>
              </div>
            </div>

            {/* Pending Bookings */}
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
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-600">PENDING</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Approved / Rejected */}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${b.status === "approved" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>{b.status.toUpperCase()}</span>
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

      {tab === "users" && <UsersPage />}

      {tab === "activity" && canViewActivityLog && <ActivityLogPage />}
    </div>
  );
}

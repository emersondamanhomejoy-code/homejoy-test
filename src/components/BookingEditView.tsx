import { useState, useMemo, useEffect } from "react";
import { Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  booking: Booking;
  onBack: () => void;
}

export function BookingEditView({ booking, onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const [saving, setSaving] = useState(false);

  const availableRooms = useMemo(() => {
    return roomsData.filter(r => r.room_type !== "Car Park" && (r.status === "Available" || r.id === booking.room_id));
  }, [roomsData, booking.room_id]);

  const [form, setForm] = useState({
    roomId: booking.room_id || "",
    tenantName: booking.tenant_name || "",
    phone: booking.tenant_phone || "",
    email: booking.tenant_email || "",
    icPassport: booking.tenant_ic_passport || "",
    gender: booking.tenant_gender || "",
    race: booking.tenant_race || "",
    nationality: booking.tenant_nationality || "",
    moveInDate: booking.move_in_date || "",
    occupation: booking.occupation || "",
    company: booking.company || "",
    position: booking.position || "",
    contractMonths: String(booking.contract_months || 12),
    monthlySalary: String(booking.monthly_salary || 0),
    paxStaying: String(booking.pax_staying || 1),
    accessCardCount: String(booking.access_card_count || 0),
    emergency1Name: booking.emergency_1_name || "",
    emergency1Phone: booking.emergency_1_phone || "",
    emergency1Relationship: booking.emergency_1_relationship || "",
    emergency2Name: booking.emergency_2_name || "",
    emergency2Phone: booking.emergency_2_phone || "",
    emergency2Relationship: booking.emergency_2_relationship || "",
    parking: booking.parking || "0",
    carPlate: booking.car_plate || "",
    advance: String((booking.move_in_cost as any)?.advance || booking.monthly_salary || 0),
    electricityReload: String((booking.move_in_cost as any)?.electricityReload || 0),
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const selectedRoom = roomsData.find(r => r.id === form.roomId) || null;
  const unitCfg = selectedRoom ? unitsData.find(u => u.id === selectedRoom.unit_id) : null;
  const depMul = unitCfg?.deposit_multiplier ?? 1.5;
  const unitAdminFee = unitCfg?.admin_fee ?? 330;
  const perCardCost = unitCfg?.access_card_deposit ?? 0;
  const cardCount = Number(form.accessCardCount) || 0;
  const adv = Number(form.advance) || 0;
  const dep = Math.round(adv * depMul);
  const elecReload = Number(form.electricityReload) || 0;
  const accessCardDep = cardCount * perCardCost;
  const total = adv + dep + unitAdminFee + elecReload + accessCardDep;

  const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full";
  const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  const handleSave = async () => {
    if (!form.tenantName.trim() || !form.phone.trim()) {
      toast.error("Tenant name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const moveInCost = { advance: adv, deposit: dep, adminFee: unitAdminFee, electricityReload: elecReload, accessCardDeposit: accessCardDep, total };

      // If room changed, update old room to Available and new room to Pending
      if (form.roomId !== booking.room_id) {
        if (booking.room_id) {
          await supabase.from("rooms").update({ status: "Available" }).eq("id", booking.room_id);
        }
        if (form.roomId) {
          await supabase.from("rooms").update({ status: "Pending" }).eq("id", form.roomId);
        }
      }

      const room = roomsData.find(r => r.id === form.roomId);
      const { error } = await supabase.from("bookings").update({
        room_id: form.roomId || null,
        unit_id: room?.unit_id || null,
        tenant_name: form.tenantName,
        tenant_phone: form.phone,
        tenant_email: form.email,
        tenant_ic_passport: form.icPassport,
        tenant_gender: form.gender,
        tenant_race: form.race,
        tenant_nationality: form.nationality,
        move_in_date: form.moveInDate,
        occupation: form.occupation,
        company: form.company,
        position: form.position,
        contract_months: Number(form.contractMonths) || 12,
        monthly_salary: Number(form.monthlySalary) || 0,
        pax_staying: Number(form.paxStaying) || 1,
        access_card_count: cardCount,
        emergency_1_name: form.emergency1Name,
        emergency_1_phone: form.emergency1Phone,
        emergency_1_relationship: form.emergency1Relationship,
        emergency_2_name: form.emergency2Name,
        emergency_2_phone: form.emergency2Phone,
        emergency_2_relationship: form.emergency2Relationship,
        parking: form.parking,
        car_plate: form.carPlate,
        move_in_cost: moveInCost,
      }).eq("id", booking.id);

      if (error) throw error;

      if (user) {
        await supabase.from("activity_logs").insert({
          actor_id: user.id, actor_email: user.email || "",
          action: "edit_booking", entity_type: "booking", entity_id: booking.id,
          details: { tenant_name: form.tenantName },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Booking updated");
      onBack();
    } catch (e: any) {
      toast.error(e.message || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (title: string) => (
    <div className="text-lg font-bold flex items-center gap-2 border-b border-border pb-2">{title}</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Booking Details
        </button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>

      <h2 className="text-xl font-bold">Edit Booking — {booking.tenant_name}</h2>

      {/* Room Selection */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        {sectionTitle("🏠 Room")}
        <div className="space-y-1">
          <label className={lbl}>Room</label>
          <select className={ic} value={form.roomId} onChange={e => {
            const room = roomsData.find(r => r.id === e.target.value);
            setForm(prev => ({ ...prev, roomId: e.target.value, monthlySalary: room ? String(room.rent) : prev.monthlySalary, advance: room ? String(room.rent) : prev.advance }));
          }}>
            <option value="">— Select Room —</option>
            {availableRooms.map(r => (
              <option key={r.id} value={r.id}>{r.building} · {r.unit} · {r.room} — RM{r.rent}/mo ({r.room_type})</option>
            ))}
          </select>
        </div>
        {selectedRoom && (
          <div className="bg-primary/10 rounded-lg p-4 text-sm space-y-1">
            <div className="font-semibold">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</div>
            <div>Monthly Rent: <strong>RM{selectedRoom.rent}</strong> · Type: {selectedRoom.room_type}</div>
          </div>
        )}
      </div>

      {/* Tenant Details */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        {sectionTitle("👤 Tenant Details")}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} value={form.tenantName} onChange={e => set("tenantName", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>NRIC/Passport</label><input className={ic} value={form.icPassport} onChange={e => set("icPassport", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Gender</label>
            <select className={ic} value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">Select</option><option>Male</option><option>Female</option><option>Couple</option><option>2 Pax</option>
            </select>
          </div>
          <div className="space-y-1"><label className={lbl}>Nationality</label><input className={ic} value={form.nationality} onChange={e => set("nationality", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Race</label><input className={ic} value={form.race} onChange={e => set("race", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Move-in Date</label><input className={ic} type="date" value={form.moveInDate} onChange={e => set("moveInDate", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} value={form.occupation} onChange={e => set("occupation", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Company</label><input className={ic} value={form.company} onChange={e => set("company", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Position</label><input className={ic} value={form.position} onChange={e => set("position", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Contract (months)</label>
            <select className={ic} value={form.contractMonths} onChange={e => set("contractMonths", e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className={lbl}>Monthly Rental (RM)</label><input className={ic} type="number" value={form.monthlySalary} onChange={e => { set("monthlySalary", e.target.value); set("advance", e.target.value); }} /></div>
          <div className="space-y-1"><label className={lbl}>Pax Staying</label><input className={ic} type="number" value={form.paxStaying} onChange={e => set("paxStaying", e.target.value)} /></div>
          <div className="space-y-1"><label className={lbl}>Access Cards</label><input className={ic} type="number" value={form.accessCardCount} onChange={e => set("accessCardCount", e.target.value)} /></div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        {sectionTitle("🚨 Emergency Contacts")}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Contact 1</div>
            <div className="space-y-1"><label className={lbl}>Name</label><input className={ic} value={form.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Phone</label><input className={ic} value={form.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Relationship</label><input className={ic} value={form.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} /></div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">Contact 2</div>
            <div className="space-y-1"><label className={lbl}>Name</label><input className={ic} value={form.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Phone</label><input className={ic} value={form.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Relationship</label><input className={ic} value={form.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* Parking */}
      <div className="bg-card rounded-lg border p-5 space-y-4">
        {sectionTitle("🅿️ Parking")}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1"><label className={lbl}>Parking Count</label>
            <select className={ic} value={form.parking} onChange={e => set("parking", e.target.value)}>
              <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>
          {Number(form.parking) > 0 && (
            <div className="space-y-1"><label className={lbl}>Car Plate(s)</label><input className={ic} value={form.carPlate} onChange={e => set("carPlate", e.target.value)} placeholder="e.g. ABC1234, DEF5678" /></div>
          )}
        </div>
      </div>

      {/* Move-in Cost */}
      {selectedRoom && (
        <div className="bg-card rounded-lg border p-5 space-y-4">
          {sectionTitle("💰 Move-in Cost")}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className={lbl}>1 Month Advance Rental (RM)</label><input className={ic} type="number" value={form.advance} onChange={e => set("advance", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Rental Deposit (RM) — ×{depMul}</label><input className={`${ic} bg-muted`} type="number" readOnly value={dep} /></div>
            <div className="space-y-1"><label className={lbl}>Admin Fee (RM)</label><input className={`${ic} bg-muted`} type="number" readOnly value={unitAdminFee} /></div>
            <div className="space-y-1"><label className={lbl}>Electricity Reload (RM)</label><input className={ic} type="number" value={form.electricityReload} onChange={e => set("electricityReload", e.target.value)} /></div>
            <div className="space-y-1"><label className={lbl}>Access Card Deposit — {cardCount} × RM{perCardCost}</label><input className={`${ic} bg-muted`} type="number" readOnly value={accessCardDep} /></div>
          </div>
          <div className="bg-secondary rounded-lg p-4 text-right">
            <span className="text-sm text-muted-foreground">Total: </span>
            <span className="text-lg font-bold">RM{total}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StandardModal } from "@/components/ui/standard-modal";
import { inputClass, labelClass } from "@/lib/ui-constants";
import { toast } from "sonner";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

interface AccessItem {
  id: string;
  access_type: string;
  provided_by: string;
  chargeable_type: string;
  price: number;
}

interface Props {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingEditView({ booking, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const { data: condosData = [] } = useCondos();
  const [saving, setSaving] = useState(false);
  const { errors, validate, clearError } = useFormValidation();
  const existingDocs = booking.documents as any;
  const existingCarParks: { roomId: string; carPlate: string }[] = existingDocs?.carParkSelections || [];

  const [form, setForm] = useState({
    roomId: booking.room_id || "",
    exactRental: String((booking.move_in_cost as any)?.advance || booking.monthly_salary || 0),
    paxStaying: String(booking.pax_staying || 1),
    tenancyDuration: String(booking.contract_months || 12),
    moveInDate: booking.move_in_date || "",
    parkingCount: String(existingCarParks.length),
    carParkSelections: existingCarParks as { roomId: string; carPlate: string }[],
    tenantName: booking.tenant_name || "",
    phone: booking.tenant_phone || "",
    email: booking.tenant_email || "",
    icPassport: booking.tenant_ic_passport || "",
    gender: booking.tenant_gender || "",
    nationality: booking.tenant_nationality || "",
    occupation: booking.occupation || "",
    emergency1Name: booking.emergency_1_name || "",
    emergency1Phone: booking.emergency_1_phone || "",
    emergency1Relationship: booking.emergency_1_relationship || "",
    emergency2Name: booking.emergency_2_name || "",
    emergency2Phone: booking.emergency_2_phone || "",
    emergency2Relationship: booking.emergency_2_relationship || "",
  });

  const [roomSearch, setRoomSearch] = useState("");
  const [carParkSearch, setCarParkSearch] = useState<Record<number, string>>({});

  const set = (k: string, v: string) => { setForm(prev => ({ ...prev, [k]: v })); clearError(k); };

  // Track dirty state
  const initialFormRef = useMemo(() => ({
    roomId: booking.room_id || "",
    exactRental: String((booking.move_in_cost as any)?.advance || booking.monthly_salary || 0),
    paxStaying: String(booking.pax_staying || 1),
    tenancyDuration: String(booking.contract_months || 12),
    moveInDate: booking.move_in_date || "",
    parkingCount: String(existingCarParks.length),
    tenantName: booking.tenant_name || "",
    phone: booking.tenant_phone || "",
    email: booking.tenant_email || "",
    icPassport: booking.tenant_ic_passport || "",
    gender: booking.tenant_gender || "",
    nationality: booking.tenant_nationality || "",
    occupation: booking.occupation || "",
    emergency1Name: booking.emergency_1_name || "",
    emergency1Phone: booking.emergency_1_phone || "",
    emergency1Relationship: booking.emergency_1_relationship || "",
    emergency2Name: booking.emergency_2_name || "",
    emergency2Phone: booking.emergency_2_phone || "",
    emergency2Relationship: booking.emergency_2_relationship || "",
  }), [booking]);

  const isDirty = useMemo(() => {
    const { carParkSelections, ...rest } = form;
    const { parkingCount: _, ...initial } = initialFormRef;
    return JSON.stringify(rest) !== JSON.stringify({ ...initial, parkingCount: form.parkingCount });
  }, [form, initialFormRef]);

  const availableRooms = useMemo(() => {
    let rooms = roomsData.filter(r => r.room_type !== "Car Park" && (r.status === "Available" || r.id === booking.room_id));
    if (roomSearch.trim()) {
      const s = roomSearch.toLowerCase();
      rooms = rooms.filter(r => `${r.building} ${r.unit} ${r.room}`.toLowerCase().includes(s));
    }
    return rooms;
  }, [roomsData, booking.room_id, roomSearch]);

  const selectedRoom = roomsData.find(r => r.id === form.roomId) || null;
  const unitCfg = selectedRoom ? unitsData.find(u => u.id === selectedRoom.unit_id) : null;

  const selectedCondo = useMemo(() => {
    if (!selectedRoom) return null;
    return condosData.find(c => c.name === selectedRoom.building) || null;
  }, [selectedRoom, condosData]);

  const condoAccess = useMemo(() => {
    if (!selectedCondo) return { pedestrian: [] as AccessItem[], carpark: [] as AccessItem[] };
    const raw = (selectedCondo as any).access_items || {};
    const parse = (key: string): AccessItem[] => {
      const items = raw[key];
      if (Array.isArray(items)) return items.filter((i: any) => i.access_type && i.access_type !== "None");
      return [];
    };
    return { pedestrian: parse("pedestrian"), carpark: parse("carpark") };
  }, [selectedCondo]);

  const chargeableAccess = useMemo(() => {
    return [...condoAccess.pedestrian].filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  const chargeableCarpark = useMemo(() => {
    return condoAccess.carpark.filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  const availableCarParks = useMemo(() => {
    if (!selectedRoom) return [];
    return roomsData.filter(r => r.room_type === "Car Park" && r.building === selectedRoom.building && (r.status === "Available" || existingCarParks.some(e => e.roomId === r.id)));
  }, [roomsData, selectedRoom, existingCarParks]);

  const pax = Number(form.paxStaying) || 1;
  const exactRental = Number(form.exactRental) || 0;
  const depMul = unitCfg?.deposit_multiplier ?? 1.5;
  const adminFee = unitCfg?.admin_fee ?? 330;

  const accessFeesBreakdown = useMemo(() => {
    return chargeableAccess.map(a => ({
      label: `${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`,
      unitPrice: a.price, qty: pax, total: a.price * pax,
    }));
  }, [chargeableAccess, pax]);

  const carparkFeesBreakdown = useMemo(() => {
    const pc = Number(form.parkingCount) || 0;
    return chargeableCarpark.map(a => ({
      label: `Car Park ${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`,
      unitPrice: a.price, qty: pc, total: a.price * pc,
    }));
  }, [chargeableCarpark, form.parkingCount]);

  const carparkRentalTotal = useMemo(() => {
    return form.carParkSelections.reduce((sum, sel) => {
      const cp = roomsData.find(r => r.id === sel.roomId);
      return sum + (cp?.rent || 0);
    }, 0);
  }, [form.carParkSelections, roomsData]);

  const deposit = Math.round(exactRental * depMul);
  const totalAccessFees = accessFeesBreakdown.reduce((s, f) => s + f.total, 0);
  const totalCarparkFees = carparkFeesBreakdown.reduce((s, f) => s + f.total, 0);
  const grandTotal = exactRental + deposit + adminFee + totalAccessFees + totalCarparkFees + carparkRentalTotal;

  const handleParkingCountChange = (count: string) => {
    const n = Number(count) || 0;
    const selections = [...form.carParkSelections];
    while (selections.length < n) selections.push({ roomId: "", carPlate: "" });
    setForm(prev => ({ ...prev, parkingCount: count, carParkSelections: selections.slice(0, n) }));
  };

  const updateCarParkSelection = (index: number, field: "roomId" | "carPlate", value: string) => {
    const selections = [...form.carParkSelections];
    selections[index] = { ...selections[index], [field]: value };
    setForm(prev => ({ ...prev, carParkSelections: selections }));
  };

  const selectedCarParkIds = form.carParkSelections.map(s => s.roomId).filter(Boolean);

  const handleSave = async () => {
    const rules: Record<string, (v: any) => string | null> = {
      tenantName: () => !form.tenantName.trim() ? "Tenant name is required" : null,
      phone: () => !form.phone.trim() ? "Phone is required" : null,
      moveInDate: () => !form.moveInDate ? "Move-in date is required" : null,
      gender: () => !form.gender ? "Gender is required" : null,
      emergency1Name: () => !form.emergency1Name.trim() ? "Required" : null,
      emergency1Phone: () => !form.emergency1Phone.trim() ? "Required" : null,
      emergency1Relationship: () => !form.emergency1Relationship.trim() ? "Required" : null,
      emergency2Name: () => !form.emergency2Name.trim() ? "Required" : null,
      emergency2Phone: () => !form.emergency2Phone.trim() ? "Required" : null,
      emergency2Relationship: () => !form.emergency2Relationship.trim() ? "Required" : null,
    };
    if (!validate(form, rules)) return;
    setSaving(true);
    try {
      const moveInCost = {
        advance: exactRental, deposit, adminFee,
        accessFees: accessFeesBreakdown, carparkFees: carparkFeesBreakdown,
        carparkRental: carparkRentalTotal, totalAccessFees, totalCarparkFees, total: grandTotal,
      };
      const parkingCount = Number(form.parkingCount) || 0;
      const carPlatesStr = form.carParkSelections.slice(0, parkingCount).map(s => s.carPlate).filter(Boolean).join(", ");

      // Room swap logic
      if (form.roomId !== booking.room_id) {
        if (booking.room_id) await supabase.from("rooms").update({ status: "Available" }).eq("id", booking.room_id);
        if (form.roomId) await supabase.from("rooms").update({ status: "Pending" }).eq("id", form.roomId);
      }

      // Release old car parks that are no longer selected
      for (const old of existingCarParks) {
        if (old.roomId && !form.carParkSelections.some(s => s.roomId === old.roomId)) {
          await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", old.roomId);
        }
      }
      // Reserve new car parks
      for (const sel of form.carParkSelections.slice(0, parkingCount)) {
        if (sel.roomId && !existingCarParks.some(e => e.roomId === sel.roomId)) {
          await supabase.from("rooms").update({ status: "Pending", tenant_gender: `${form.tenantName} (${form.gender})` }).eq("id", sel.roomId);
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
        tenant_nationality: form.nationality,
        move_in_date: form.moveInDate,
        occupation: form.occupation,
        contract_months: Number(form.tenancyDuration) || 12,
        monthly_salary: exactRental,
        pax_staying: pax,
        access_card_count: pax,
        emergency_1_name: form.emergency1Name,
        emergency_1_phone: form.emergency1Phone,
        emergency_1_relationship: form.emergency1Relationship,
        emergency_2_name: form.emergency2Name,
        emergency_2_phone: form.emergency2Phone,
        emergency_2_relationship: form.emergency2Relationship,
        parking: form.parkingCount,
        car_plate: carPlatesStr,
        move_in_cost: moveInCost,
        documents: { carParkSelections: form.carParkSelections.slice(0, parkingCount) },
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
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (emoji: string, title: string) => (
    <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">{emoji} {title}</div>
  );

  return (
    <StandardModal
      open={open}
      onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}
      title={`Edit Booking — ${booking.tenant_name}`}
      size="lg"
      isDirty={isDirty}
      footer={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Room */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          {sectionTitle("🏠", "Room")}
          <div className="space-y-1">
            <label className={labelClass}>Search Room</label>
            <input className={inputClass} placeholder="Search by building, unit, room..." value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Select Room *</label>
            <select className={inputClass} value={form.roomId} onChange={e => {
              const room = roomsData.find(r => r.id === e.target.value);
              setForm(prev => ({ ...prev, roomId: e.target.value, exactRental: room ? String(room.rent) : prev.exactRental, parkingCount: "0", carParkSelections: [] }));
            }}>
              <option value="">— Select Room —</option>
              {availableRooms.map(r => (
                <option key={r.id} value={r.id}>{r.building} · {r.unit} · {r.room} — RM{r.rent}/mo ({r.room_type})</option>
              ))}
            </select>
          </div>
          {selectedRoom && (
            <div className="bg-primary/10 rounded-lg p-3 text-sm space-y-1">
              <div className="font-semibold">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</div>
              <div>Listed Rent: <strong>RM{selectedRoom.rent}</strong> · Type: {selectedRoom.room_type} · Max Pax: {selectedRoom.max_pax}</div>
            </div>
          )}
          {selectedRoom && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Exact Rental (RM) *</label>
                <input className={inputClass} type="number" value={form.exactRental} onChange={e => set("exactRental", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>How many pax staying *</label>
                <select className={inputClass} value={form.paxStaying} onChange={e => set("paxStaying", e.target.value)}>
                  {Array.from({ length: selectedRoom.max_pax || 4 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={String(n)}>{n} pax</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Tenancy Duration *</label>
                <select className={inputClass} value={form.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 24 ? " (2 years)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Move-in Date *</label>
                <input className={inputClass} type="date" value={form.moveInDate} onChange={e => set("moveInDate", e.target.value)} />
              </div>
            </div>
          )}
          {selectedRoom && chargeableAccess.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm space-y-1">
              <div className="font-semibold text-amber-700">Chargeable Access Items (Homejoy)</div>
              {chargeableAccess.map((a, i) => (
                <div key={i} className="flex justify-between">
                  <span>{a.access_type} — {a.chargeable_type === "deposit" ? "Deposit" : "Fee"}</span>
                  <span>RM{a.price} × {pax} pax = <strong>RM{a.price * pax}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Parking */}
        {selectedRoom && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            {sectionTitle("🅿️", "Parking")}
            {availableCarParks.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-background rounded-lg border p-3">Sorry, car park is fully rented out for this building.</div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>How many parking</label>
                  <select className={inputClass} value={form.parkingCount} onChange={e => handleParkingCountChange(e.target.value)}>
                    {Array.from({ length: Math.min(availableCarParks.length + 1, 4) }, (_, i) => (
                      <option key={i} value={String(i)}>{i}</option>
                    ))}
                  </select>
                </div>
                {Array.from({ length: Number(form.parkingCount) || 0 }, (_, i) => {
                  const otherSelected = selectedCarParkIds.filter((_, idx) => idx !== i);
                  const searchStr = (carParkSearch[i] || "").toLowerCase();
                  let cpOptions = availableCarParks.filter(cp => !otherSelected.includes(cp.id));
                  if (searchStr) cpOptions = cpOptions.filter(cp => cp.room.toLowerCase().includes(searchStr));
                  const selectedCp = roomsData.find(r => r.id === form.carParkSelections[i]?.roomId);
                  return (
                    <div key={i} className="bg-background rounded-lg border p-3 space-y-2">
                      <div className="text-sm font-semibold">Parking {i + 1}</div>
                      <div className="space-y-1">
                        <label className={labelClass}>Search Car Park</label>
                        <input className={inputClass} placeholder="Search..." value={carParkSearch[i] || ""} onChange={e => setCarParkSearch(prev => ({ ...prev, [i]: e.target.value }))} />
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className={labelClass}>Car Park Lot *</label>
                          <select className={inputClass} value={form.carParkSelections[i]?.roomId || ""} onChange={e => updateCarParkSelection(i, "roomId", e.target.value)}>
                            <option value="">— Select —</option>
                            {cpOptions.map(cp => (<option key={cp.id} value={cp.id}>{cp.room} — RM{cp.rent}/mo</option>))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className={labelClass}>Car Plate No *</label>
                          <input className={inputClass} placeholder="e.g. ABC1234" value={form.carParkSelections[i]?.carPlate || ""} onChange={e => updateCarParkSelection(i, "carPlate", e.target.value)} />
                        </div>
                      </div>
                      {selectedCp && <div className="text-xs text-muted-foreground">Monthly Rental: RM{selectedCp.rent}</div>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Tenant Details */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          {sectionTitle("👤", "Tenant Details")}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>Full Name *</label><input className={inputClass} value={form.tenantName} onChange={e => set("tenantName", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>NRIC/Passport No</label><input className={inputClass} value={form.icPassport} onChange={e => set("icPassport", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Email</label><input className={inputClass} type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Contact No *</label><input className={inputClass} value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Gender *</label>
              <select className={inputClass} value={form.gender} onChange={e => set("gender", e.target.value)}>
                <option value="">Select</option><option>Male</option><option>Female</option><option>Couple</option>
              </select>
            </div>
            <div className="space-y-1"><label className={labelClass}>Nationality</label><input className={inputClass} value={form.nationality} onChange={e => set("nationality", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Occupation</label><input className={inputClass} value={form.occupation} onChange={e => set("occupation", e.target.value)} /></div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          {sectionTitle("🚨", "Emergency Contacts")}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Contact 1 *</div>
              <div className="space-y-1"><label className={labelClass}>Name</label><input className={inputClass} value={form.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Phone</label><input className={inputClass} value={form.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Relationship</label><input className={inputClass} value={form.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Contact 2 *</div>
              <div className="space-y-1"><label className={labelClass}>Name</label><input className={inputClass} value={form.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Phone</label><input className={inputClass} value={form.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Relationship</label><input className={inputClass} value={form.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* Move-in Cost */}
        {selectedRoom && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            {sectionTitle("💰", "Move-in Cost")}
            <div className="bg-background rounded-lg border divide-y divide-border">
              <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                <span>Description</span><span className="text-right">Amount (RM)</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                <span>1 Month Advance Rental</span><span className="text-right font-medium">{exactRental.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                <span>Rental Deposit (×{depMul})</span><span className="text-right font-medium">{deposit.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                <span>Admin Fee</span><span className="text-right font-medium">{adminFee.toLocaleString()}</span>
              </div>
              {accessFeesBreakdown.map((f, i) => (
                <div key={`a-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                  <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                </div>
              ))}
              {carparkFeesBreakdown.map((f, i) => (
                <div key={`c-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                  <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                </div>
              ))}
              {carparkRentalTotal > 0 && (
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>1 Month Advance Car Park Rental</span><span className="text-right font-medium">{carparkRentalTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] px-4 py-3 bg-primary/5">
                <span className="font-bold">Total Move-in Cost</span>
                <span className="text-right font-bold text-lg">RM {grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}

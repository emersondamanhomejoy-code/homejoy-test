import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { X } from "lucide-react";
import { toast } from "sonner";
import { StandardModal } from "@/components/ui/standard-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { inputClass as sharedInputClass, labelClass as sharedLabelClass } from "@/lib/ui-constants";

interface AccessItem {
  id: string;
  access_type: string;
  locations?: string[];
  provided_by: string;
  chargeable_type: string;
  price: number;
  instruction: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedRoomId?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  commissionType: string;
}

const initialForm = {
  agentId: "",
  roomId: "",
  exactRental: "",
  paxStaying: "1",
  parkingCount: "0",
  carParkSelections: [] as { roomId: string; carPlate: string }[],
  tenantName: "", phone: "", email: "", icPassport: "",
  gender: "", nationality: "", moveInDate: "",
  occupation: "", tenancyDuration: "12",
  tenant2Name: "", tenant2Phone: "", tenant2Email: "", tenant2IcPassport: "",
  tenant2Nationality: "", tenant2Occupation: "",
  emergency1Name: "", emergency1Phone: "", emergency1Relationship: "",
  emergency2Name: "", emergency2Phone: "", emergency2Relationship: "",
};

export function CreateBookingDialog({ open, onOpenChange, preSelectedRoomId }: Props) {
  const { user, role } = useAuth();
  const isAgent = role === "agent";
  const queryClient = useQueryClient();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const { data: condosData = [] } = useCondos();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ bookingFeeReceipt: File | null; passport: File | null; offerLetter: File | null }>({ bookingFeeReceipt: null, passport: null, offerLetter: null });
  const [linkedTenantDocs, setLinkedTenantDocs] = useState<{ passport: string; offerLetter: string }>({ passport: "", offerLetter: "" });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [docRemoveConfirm, setDocRemoveConfirm] = useState<"bookingFeeReceipt" | "passport" | "offerLetter" | null>(null);

  const [existingTenants, setExistingTenants] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    supabase.from("tenants").select("*").then(({ data }) => {
      if (data) setExistingTenants(data);
    });
  }, [open]);

  const isLinkedTenant = selectedTenantId != null;

  const [agents, setAgents] = useState<UserInfo[]>([]);
  useEffect(() => {
    if (!open) return;
    const fetchAgents = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role, commission_type");
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, name");
      if (roles && profiles) {
        const agentRoles = roles.filter(r => r.role === "agent");
        const agentUserIds = [...new Set(agentRoles.map(r => r.user_id))];
        setAgents(agentUserIds.map(uid => {
          const p = profiles.find(pr => pr.user_id === uid);
          const agentRole = agentRoles.find(r => r.user_id === uid);
          return { id: uid, email: p?.email || "", name: p?.name || "", commissionType: agentRole?.commission_type || "internal_basic" };
        }));
      }
    };
    fetchAgents();
  }, [open]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Auto-set agent + pre-selected room when current user is an agent
  useEffect(() => {
    if (isAgent && user?.id && open) {
      setForm(prev => ({ ...prev, agentId: user.id, ...(preSelectedRoomId ? { roomId: preSelectedRoomId } : {}) }));
    }
  }, [isAgent, user?.id, open, preSelectedRoomId]);

  // Reset room selection when agent changes (available rooms may differ)
  useEffect(() => {
    if (!isAgent) {
      setForm(prev => ({ ...prev, roomId: "", carParkSelections: [] }));
    }
  }, [form.agentId]);


  const agentOptions = useMemo(() => agents.map(a => ({
    value: a.id,
    label: a.name || a.email,
    sublabel: a.name ? a.email : undefined,
  })), [agents]);

  const selectedAgent = useMemo(() => agents.find(a => a.id === form.agentId) || null, [agents, form.agentId]);
  const isExternalAgent = selectedAgent?.commissionType === "external";

  const availableRooms = useMemo(() => {
    let rooms = roomsData.filter(r => r.room_type !== "Car Park" && r.status === "Available");
    // External agents cannot see internal-only units
    if (isExternalAgent) {
      const internalUnitIds = new Set(unitsData.filter(u => u.internal_only).map(u => u.id));
      rooms = rooms.filter(r => !r.unit_id || !internalUnitIds.has(r.unit_id));
    }
    return rooms;
  }, [roomsData, unitsData, isExternalAgent]);
  const roomOptions = useMemo(() => availableRooms.map(r => ({
    value: r.id,
    label: `${r.building} · ${r.unit} · ${r.room}${(r as any).room_title ? ` — ${(r as any).room_title}` : ""}`,
    sublabel: `RM${r.rent}/mo · ${r.room_type}`,
  })), [availableRooms]);

  const tenantOptions = useMemo(() => existingTenants.map(t => ({
    value: t.id,
    label: t.name || "—",
    sublabel: `${t.phone || ""} · ${t.email || t.ic_passport || ""}`,
  })), [existingTenants]);

  const selectedRoom = useMemo(() => roomsData.find(r => r.id === form.roomId) || null, [roomsData, form.roomId]);
  const unitCfg = selectedRoom ? unitsData.find(u => u.id === selectedRoom.unit_id) : null;

  const selectedCondo = useMemo(() => {
    if (!selectedRoom) return null;
    return condosData.find(c => c.name === selectedRoom.building) || null;
  }, [selectedRoom, condosData]);

  const condoAccess = useMemo(() => {
    if (!selectedCondo) return { pedestrian: [] as AccessItem[], carpark: [] as AccessItem[], motorcycle: [] as AccessItem[] };
    const raw = (selectedCondo as any).access_items || {};
    const parse = (key: string): AccessItem[] => {
      const items = raw[key];
      if (Array.isArray(items)) return items.filter((i: any) => i.access_type && i.access_type !== "None");
      return [];
    };
    return { pedestrian: parse("pedestrian"), carpark: parse("carpark"), motorcycle: parse("motorcycle") };
  }, [selectedCondo]);

  const chargeableAccess = useMemo(() => {
    const all = [...condoAccess.pedestrian, ...condoAccess.motorcycle];
    return all.filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  const chargeableCarpark = useMemo(() => {
    return condoAccess.carpark.filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  const availableCarParks = useMemo(() => {
    if (!selectedRoom) return [];
    return roomsData.filter(r => r.room_type === "Car Park" && r.building === selectedRoom.building && r.status === "Available");
  }, [roomsData, selectedRoom]);

  const carParkOptions = useMemo(() => {
    return availableCarParks.map(cp => ({
      value: cp.id,
      label: cp.room,
      sublabel: `RM${cp.rent}/mo`,
    }));
  }, [availableCarParks]);

  const pax = Number(form.paxStaying) || 1;
  const exactRental = Number(form.exactRental) || 0;
  const depMul = unitCfg?.deposit_multiplier ?? 1.5;
  const adminFee = unitCfg?.admin_fee ?? 330;

  const accessFeesBreakdown = useMemo(() => {
    return chargeableAccess.map(a => ({
      label: `${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : a.chargeable_type === "processing_fee" ? "Processing Fee" : "Fee"})`,
      unitPrice: a.price, qty: pax, total: a.price * pax,
    }));
  }, [chargeableAccess, pax]);

  const carparkFeesBreakdown = useMemo(() => {
    const parkingCount = Number(form.parkingCount) || 0;
    return chargeableCarpark.map(a => ({
      label: `Car Park ${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`,
      unitPrice: a.price, qty: parkingCount, total: a.price * parkingCount,
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

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const handleLinkTenant = (tenantId: string) => {
    const t = existingTenants.find(x => x.id === tenantId);
    if (!t) return;
    setSelectedTenantId(tenantId);
    setForm(prev => ({
      ...prev,
      tenantName: t.name || "", phone: t.phone || "", email: t.email || "",
      icPassport: t.ic_passport || "", gender: t.gender || "",
      nationality: t.nationality || "", occupation: t.occupation || "",
      emergency1Name: t.emergency_1_name || "", emergency1Phone: t.emergency_1_phone || "",
      emergency1Relationship: t.emergency_1_relationship || "",
      emergency2Name: t.emergency_2_name || "", emergency2Phone: t.emergency_2_phone || "",
      emergency2Relationship: t.emergency_2_relationship || "",
    }));
    const docP = Array.isArray(t.doc_passport) && t.doc_passport.length > 0 ? t.doc_passport[0] : "";
    const docO = Array.isArray(t.doc_offer_letter) && t.doc_offer_letter.length > 0 ? t.doc_offer_letter[0] : "";
    const docS = Array.isArray(t.doc_transfer_slip) && t.doc_transfer_slip.length > 0 ? t.doc_transfer_slip[0] : "";
    setLinkedTenantDocs({ passport: docP, offerLetter: docO });
    setUploadedFiles(prev => ({ ...prev, bookingFeeReceipt: null, passport: null, offerLetter: null }));
  };

  const handleUnlinkTenant = () => {
    setSelectedTenantId(null);
    setLinkedTenantDocs({ passport: "", offerLetter: "" });
    setUploadedFiles({ bookingFeeReceipt: null, passport: null, offerLetter: null });
    setForm(prev => ({ ...prev, tenantName: "", phone: "", email: "", icPassport: "", gender: "", nationality: "", occupation: "",
      emergency1Name: "", emergency1Phone: "", emergency1Relationship: "",
      emergency2Name: "", emergency2Phone: "", emergency2Relationship: "" }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.agentId) { toast.error("Please select an agent"); return; }
    if (!form.roomId) { toast.error("Please select a room"); return; }
    if (!form.exactRental || Number(form.exactRental) <= 0) { toast.error("Please enter exact rental"); return; }
    if (!form.tenantName.trim()) { toast.error("Please fill in tenant name"); return; }
    if (!form.phone.trim()) { toast.error("Please fill in contact number"); return; }
    if (!form.moveInDate) { toast.error("Please select move-in date"); return; }
    if (!form.gender) { toast.error("Please select gender"); return; }
    if (!form.emergency1Name || !form.emergency1Phone || !form.emergency1Relationship) { toast.error("Please complete Emergency Contact 1"); return; }
    if (!form.emergency2Name || !form.emergency2Phone || !form.emergency2Relationship) { toast.error("Please complete Emergency Contact 2"); return; }

    const parkingCount = Number(form.parkingCount) || 0;
    for (let i = 0; i < parkingCount; i++) {
      if (!form.carParkSelections[i]?.roomId) { toast.error(`Please select car park lot ${i + 1}`); return; }
      if (!form.carParkSelections[i]?.carPlate.trim()) { toast.error(`Please fill in car plate for parking ${i + 1}`); return; }
    }

    setSubmitting(true);
    try {
      const passportPath = linkedTenantDocs.passport || (uploadedFiles.passport ? await uploadFile(uploadedFiles.passport, "passport") : "");
      const offerPath = linkedTenantDocs.offerLetter || (uploadedFiles.offerLetter ? await uploadFile(uploadedFiles.offerLetter, "offer-letter") : "");
      const receiptPath = uploadedFiles.bookingFeeReceipt ? await uploadFile(uploadedFiles.bookingFeeReceipt, "booking-fee-receipt") : "";

      const moveInCost = {
        advance: exactRental, deposit, adminFee,
        accessFees: accessFeesBreakdown, carparkFees: carparkFeesBreakdown,
        carparkRental: carparkRentalTotal, totalAccessFees, totalCarparkFees, total: grandTotal,
      };

      const carPlatesStr = form.carParkSelections.slice(0, parkingCount).map(s => s.carPlate).filter(Boolean).join(", ");

      const { error: dbErr } = await supabase.from("bookings").insert({
        room_id: form.roomId,
        unit_id: selectedRoom?.unit_id || null,
        tenant_name: form.tenantName,
        tenant_phone: form.phone,
        tenant_email: form.email,
        tenant_ic_passport: form.icPassport,
        tenant_gender: form.gender,
        tenant_race: "",
        tenant_nationality: form.nationality,
        move_in_date: form.moveInDate,
        contract_months: Number(form.tenancyDuration) || 12,
        monthly_salary: exactRental,
        occupation: form.occupation,
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
        submitted_by: form.agentId,
        submitted_by_type: "agent",
        move_in_cost: moveInCost,
        doc_passport: passportPath ? [passportPath] : [],
        doc_offer_letter: offerPath ? [offerPath] : [],
        doc_transfer_slip: receiptPath ? [receiptPath] : [],
        documents: {
          carParkSelections: form.carParkSelections.slice(0, parkingCount),
          ...(form.gender === "Couple" ? {
            tenant2: {
              name: form.tenant2Name, phone: form.tenant2Phone, email: form.tenant2Email,
              icPassport: form.tenant2IcPassport,
              nationality: form.tenant2Nationality, occupation: form.tenant2Occupation,
            },
          } : {}),
        },
      });
      if (dbErr) throw dbErr;

      await supabase.from("rooms").update({ status: "Pending" }).eq("id", form.roomId);
      for (const sel of form.carParkSelections.slice(0, parkingCount)) {
        if (sel.roomId) {
          await supabase.from("rooms").update({
            status: "Pending", tenant_gender: `${form.tenantName} (${form.gender || ""})`,
          }).eq("id", sel.roomId);
        }
      }

      toast.success("Booking created successfully!");
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setUploadedFiles({ bookingFeeReceipt: null, passport: null, offerLetter: null });
    setLinkedTenantDocs({ passport: "", offerLetter: "" });
    setSelectedTenantId(null);
  };

  const ic = sharedInputClass;
  const lbl = sharedLabelClass;

  const sectionTitle = (emoji: string, title: string) => (
    <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">{emoji} {title}</div>
  );

  const receiptFileName = uploadedFiles.bookingFeeReceipt?.name || null;
  const hasReceipt = uploadedFiles.bookingFeeReceipt != null;

  const removeDoc = (key: "bookingFeeReceipt" | "passport" | "offerLetter") => {
    setUploadedFiles(prev => ({ ...prev, [key]: null }));
    if (key === "passport") setLinkedTenantDocs(prev => ({ ...prev, passport: "" }));
    if (key === "offerLetter") setLinkedTenantDocs(prev => ({ ...prev, offerLetter: "" }));
  };

  const formIsDirty = !!(form.tenantName.trim() || form.roomId || form.agentId);

  return (
    <>
      <StandardModal
        open={open}
        onOpenChange={(o) => { if (!o) onOpenChange(false); }}
        title="Create Booking"
        size="lg"
        isDirty={formIsDirty}
        footer={
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Create Booking"}</Button>
        }
      >
        <div className="space-y-5">
          {/* 1. Agent Selection — hidden for agents */}
          {!isAgent && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              {sectionTitle("👤", "Agent")}
              <div className="space-y-1">
                <label className={lbl}>Select Agent *</label>
                <SearchableSelect
                  options={agentOptions}
                  value={form.agentId}
                  onChange={v => set("agentId", v)}
                  placeholder="— Select Agent —"
                  searchPlaceholder="Search by name or email..."
                />
              </div>
            </div>
          )}

          {/* 2. Room Selection */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            {sectionTitle("🏠", "Room")}
            <div className="space-y-1">
              <label className={lbl}>Select Room *</label>
              <SearchableSelect
                options={roomOptions}
                value={form.roomId}
                onChange={v => {
                  const room = roomsData.find(r => r.id === v);
                  setForm(prev => ({
                    ...prev, roomId: v,
                    exactRental: room ? String(room.rent) : "",
                    parkingCount: "0", carParkSelections: [],
                  }));
                }}
                placeholder="— Select Room —"
                searchPlaceholder="Search by building, unit, room..."
              />
            </div>
            {selectedRoom && (
              <div className="bg-primary/10 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}{(selectedRoom as any).room_title ? ` — ${(selectedRoom as any).room_title}` : ""}</div>
                <div>Listed Rent: <strong>RM{selectedRoom.rent}</strong> · Type: {selectedRoom.room_type} · Max Pax: {selectedRoom.max_pax}</div>
              </div>
            )}
            {selectedRoom && (
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={lbl}>Exact Rental (RM) *</label>
                  <input className={`${ic} w-full`} type="number" value={form.exactRental} onChange={e => set("exactRental", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={lbl}>How many pax staying *</label>
                  <select className={`${ic} w-full`} value={form.paxStaying} onChange={e => set("paxStaying", e.target.value)}>
                    {Array.from({ length: selectedRoom.max_pax || 4 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={String(n)}>{n} pax</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={lbl}>Move-in Date *</label>
                  <input className={`${ic} w-full`} type="date" value={form.moveInDate} onChange={e => set("moveInDate", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={lbl}>Tenancy Duration *</label>
                  <select className={`${ic} w-full`} value={form.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 24 ? " (2 years)" : ""}</option>
                    ))}
                  </select>
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

          {/* 3. Parking */}
          {selectedRoom && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              {sectionTitle("🅿️", "Parking")}
              {availableCarParks.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-background rounded-lg border p-3">Sorry, car park is fully rented out for this building.</div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className={lbl}>How many parking</label>
                    <select className={`${ic} w-full`} value={form.parkingCount} onChange={e => handleParkingCountChange(e.target.value)}>
                      {Array.from({ length: Math.min(availableCarParks.length + 1, 4) }, (_, i) => (
                        <option key={i} value={String(i)}>{i}</option>
                      ))}
                    </select>
                  </div>

                  {Array.from({ length: Number(form.parkingCount) || 0 }, (_, i) => {
                    const otherSelected = selectedCarParkIds.filter((_, idx) => idx !== i);
                    const cpOpts = carParkOptions.filter(cp => !otherSelected.includes(cp.value));
                    const selectedCp = roomsData.find(r => r.id === form.carParkSelections[i]?.roomId);
                    return (
                      <div key={i} className="bg-background rounded-lg border p-3 space-y-2">
                        <div className="text-sm font-semibold">Parking {i + 1}</div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className={lbl}>Car Park Lot *</label>
                            <SearchableSelect
                              options={cpOpts}
                              value={form.carParkSelections[i]?.roomId || ""}
                              onChange={v => updateCarParkSelection(i, "roomId", v)}
                              placeholder="— Select Car Park —"
                              searchPlaceholder="Search car park..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={lbl}>Car Plate No *</label>
                            <input className={`${ic} w-full`} placeholder="e.g. ABC1234" value={form.carParkSelections[i]?.carPlate || ""} onChange={e => updateCarParkSelection(i, "carPlate", e.target.value)} />
                          </div>
                        </div>
                        {selectedCp && (
                          <div className="text-xs text-muted-foreground">Monthly Rental: RM{selectedCp.rent}</div>
                        )}
                      </div>
                    );
                  })}

                  {chargeableCarpark.length > 0 && Number(form.parkingCount) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm space-y-1">
                      <div className="font-semibold text-amber-700">Chargeable Car Park Access (Homejoy)</div>
                      {chargeableCarpark.map((a, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{a.access_type} — {a.chargeable_type === "deposit" ? "Deposit" : "Fee"}</span>
                          <span>RM{a.price} × {form.parkingCount} = <strong>RM{a.price * (Number(form.parkingCount) || 0)}</strong></span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 4. Tenant Details (Accordion) */}
          <Accordion type="multiple" defaultValue={["tenant-details", "emergency-contacts"]} className="space-y-3">
            <AccordionItem value="tenant-details" className="bg-muted/50 rounded-lg border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="text-base font-bold flex items-center gap-2">👤 Tenant Details</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <label className={lbl}>Link Existing Tenant (optional)</label>
                  <SearchableSelect
                    options={tenantOptions}
                    value={selectedTenantId || ""}
                    onChange={v => { if (v) handleLinkTenant(v); else handleUnlinkTenant(); }}
                    placeholder="— Select Existing Tenant —"
                    searchPlaceholder="Search by name, phone, email, IC..."
                  />
                </div>

                {isLinkedTenant && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-2 text-sm">
                    <span className="font-semibold">Linked:</span> {form.tenantName}
                    <button type="button" className="ml-auto text-xs underline hover:no-underline" onClick={handleUnlinkTenant}>Unlink</button>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={`${ic} w-full`} placeholder="Full Name" value={form.tenantName} onChange={e => set("tenantName", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>NRIC/Passport No</label><input className={`${ic} w-full`} placeholder="NRIC/Passport No" value={form.icPassport} onChange={e => set("icPassport", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Email</label><input className={`${ic} w-full`} type="email" placeholder="Email" value={form.email} onChange={e => set("email", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={`${ic} w-full`} placeholder="Contact No" value={form.phone} onChange={e => set("phone", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Gender *</label>
                    <select className={`${ic} w-full`} value={form.gender} onChange={e => set("gender", e.target.value)} disabled={isLinkedTenant}>
                      <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Couple</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className={lbl}>Nationality</label><input className={`${ic} w-full`} placeholder="Nationality" value={form.nationality} onChange={e => set("nationality", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Occupation</label><input className={`${ic} w-full`} placeholder="Occupation" value={form.occupation} onChange={e => set("occupation", e.target.value)} disabled={isLinkedTenant} /></div>
                </div>

                {/* Document uploads */}
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className={lbl}>Upload Passport / IC</label>
                    {(linkedTenantDocs.passport || uploadedFiles.passport) ? (
                      <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                        <span className="text-sm flex-1 truncate">{linkedTenantDocs.passport ? linkedTenantDocs.passport.split("/").pop() : uploadedFiles.passport?.name}</span>
                        {!isLinkedTenant && (
                          <button type="button" onClick={() => setDocRemoveConfirm("passport")}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                        <span className="text-muted-foreground">Choose File</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setUploadedFiles(prev => ({ ...prev, passport: file }));
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className={lbl}>Upload Offer Letter</label>
                    {(linkedTenantDocs.offerLetter || uploadedFiles.offerLetter) ? (
                      <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                        <span className="text-sm flex-1 truncate">{linkedTenantDocs.offerLetter ? linkedTenantDocs.offerLetter.split("/").pop() : uploadedFiles.offerLetter?.name}</span>
                        {!isLinkedTenant && (
                          <button type="button" onClick={() => setDocRemoveConfirm("offerLetter")}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                        <span className="text-muted-foreground">Choose File</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setUploadedFiles(prev => ({ ...prev, offerLetter: file }));
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                {form.gender === "Couple" && (
                  <div className="mt-3 p-3 border border-dashed border-primary/30 rounded-lg space-y-3">
                    <div className="text-sm font-bold flex items-center gap-2">👥 Second Tenant Details</div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1"><label className={lbl}>Full Name</label><input className={`${ic} w-full`} placeholder="Full Name" value={form.tenant2Name} onChange={e => set("tenant2Name", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>NRIC/Passport No</label><input className={`${ic} w-full`} placeholder="NRIC/Passport No" value={form.tenant2IcPassport} onChange={e => set("tenant2IcPassport", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Email</label><input className={`${ic} w-full`} type="email" placeholder="Email" value={form.tenant2Email} onChange={e => set("tenant2Email", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Contact No</label><input className={`${ic} w-full`} placeholder="Contact No" value={form.tenant2Phone} onChange={e => set("tenant2Phone", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Nationality</label><input className={`${ic} w-full`} placeholder="Nationality" value={form.tenant2Nationality} onChange={e => set("tenant2Nationality", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Occupation</label><input className={`${ic} w-full`} placeholder="Occupation" value={form.tenant2Occupation} onChange={e => set("tenant2Occupation", e.target.value)} /></div>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 5. Emergency Contacts (Accordion) */}
            <AccordionItem value="emergency-contacts" className="bg-muted/50 rounded-lg border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="text-base font-bold flex items-center gap-2">🚨 Emergency Contacts</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 1 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><input className={`${ic} w-full`} placeholder="Name" value={form.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><input className={`${ic} w-full`} placeholder="Phone" value={form.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><input className={`${ic} w-full`} placeholder="e.g. Father" value={form.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} disabled={isLinkedTenant} /></div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 2 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><input className={`${ic} w-full`} placeholder="Name" value={form.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><input className={`${ic} w-full`} placeholder="Phone" value={form.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><input className={`${ic} w-full`} placeholder="e.g. Spouse" value={form.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} disabled={isLinkedTenant} /></div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* 6. Upload Booking Fee Receipt */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            {sectionTitle("🧾", "Upload Booking Fee Receipt")}
            <div className="space-y-1">
              {hasReceipt ? (
                <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                  <span className="text-sm flex-1 truncate">{receiptFileName}</span>
                  <button type="button" onClick={() => setDocRemoveConfirm("bookingFeeReceipt")}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove file">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                  <span className="text-muted-foreground">Choose File</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setUploadedFiles(prev => ({ ...prev, bookingFeeReceipt: file }));
                    e.target.value = "";
                  }} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">⚠️ Booking fee is non-refundable once transferred. Please ensure tenant has confirmed before submitting.</p>
          </div>

          {/* 7. Move-in Cost */}
          {selectedRoom && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              {sectionTitle("💰", "Move-in Cost")}
              <div className="bg-background rounded-lg border divide-y divide-border">
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  <span>Description</span>
                  <span className="text-right">Amount (RM)</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>1 Month Advance Rental</span>
                  <span className="text-right font-medium">{exactRental.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>Rental Deposit (×{depMul})</span>
                  <span className="text-right font-medium">{deposit.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                  <span>Admin Fee</span>
                  <span className="text-right font-medium">{adminFee.toLocaleString()}</span>
                </div>
                {accessFeesBreakdown.map((f, i) => (
                  <div key={`access-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                    <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                    <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                  </div>
                ))}
                {(Number(form.parkingCount) || 0) > 0 && carparkFeesBreakdown.map((f, i) => (
                  <div key={`cp-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                    <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                    <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                  </div>
                ))}
                {carparkRentalTotal > 0 && (
                  <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                    <span>1 Month Advance Car Park Rental</span>
                    <span className="text-right font-medium">{carparkRentalTotal.toLocaleString()}</span>
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

      {/* Document remove confirmation */}
      <ConfirmDialog
        open={!!docRemoveConfirm}
        onOpenChange={(open) => { if (!open) setDocRemoveConfirm(null); }}
        title="Remove file?"
        description="Are you sure you want to remove this file? You can upload a new one after removing."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => { if (docRemoveConfirm) removeDoc(docRemoveConfirm); setDocRemoveConfirm(null); }}
      />
    </>
  );
}

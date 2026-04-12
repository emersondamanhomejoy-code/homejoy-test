import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { X } from "lucide-react";
import { toast } from "sonner";

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
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
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

export function CreateBookingDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const { data: condosData = [] } = useCondos();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ passport: File | null; offerLetter: File | null; transferSlip: File | null }>({ passport: null, offerLetter: null, transferSlip: null });
  const [linkedTenantDocs, setLinkedTenantDocs] = useState<{ passport: string; offerLetter: string; transferSlip: string }>({ passport: "", offerLetter: "", transferSlip: "" });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Fetch existing tenants
  const [existingTenants, setExistingTenants] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    supabase.from("tenants").select("*").then(({ data }) => {
      if (data) setExistingTenants(data);
    });
  }, [open]);

  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return existingTenants.slice(0, 20);
    const s = tenantSearch.toLowerCase();
    return existingTenants.filter(t => 
      (t.name || "").toLowerCase().includes(s) || 
      (t.phone || "").toLowerCase().includes(s) ||
      (t.email || "").toLowerCase().includes(s) ||
      (t.ic_passport || "").toLowerCase().includes(s)
    ).slice(0, 20);
  }, [existingTenants, tenantSearch]);

  const isLinkedTenant = selectedTenantId != null;

  const [agents, setAgents] = useState<UserInfo[]>([]);
  useEffect(() => {
    if (!open) return;
    const fetchAgents = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, name");
      if (roles && profiles) {
        const agentUserIds = [...new Set(roles.filter(r => r.role === "agent").map(r => r.user_id))];
        setAgents(agentUserIds.map(uid => {
          const p = profiles.find(pr => pr.user_id === uid);
          return { id: uid, email: p?.email || "", name: p?.name || "" };
        }));
      }
    };
    fetchAgents();
  }, [open]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return agents;
    const s = agentSearch.toLowerCase();
    return agents.filter(a => (a.name || "").toLowerCase().includes(s) || a.email.toLowerCase().includes(s));
  }, [agents, agentSearch]);

  const availableRooms = useMemo(() => {
    let rooms = roomsData.filter(r => r.room_type !== "Car Park" && r.status === "Available");
    if (roomSearch.trim()) {
      const s = roomSearch.toLowerCase();
      rooms = rooms.filter(r => `${r.building} ${r.unit} ${r.room}`.toLowerCase().includes(s));
    }
    return rooms;
  }, [roomsData, roomSearch]);
  const selectedRoom = useMemo(() => roomsData.find(r => r.id === form.roomId) || null, [roomsData, form.roomId]);
  const unitCfg = selectedRoom ? unitsData.find(u => u.id === selectedRoom.unit_id) : null;

  // Find the condo for the selected room by matching building name
  const selectedCondo = useMemo(() => {
    if (!selectedRoom) return null;
    return condosData.find(c => c.name === selectedRoom.building) || null;
  }, [selectedRoom, condosData]);

  // Parse condo access items
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

  // Chargeable access items (Homejoy only)
  const chargeableAccess = useMemo(() => {
    const all = [...condoAccess.pedestrian, ...condoAccess.motorcycle];
    return all.filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  const chargeableCarpark = useMemo(() => {
    return condoAccess.carpark.filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0);
  }, [condoAccess]);

  // Available car park lots from same building
  const availableCarParks = useMemo(() => {
    if (!selectedRoom) return [];
    return roomsData.filter(r => r.room_type === "Car Park" && r.building === selectedRoom.building && r.status === "Available");
  }, [roomsData, selectedRoom]);

  // Cost calculations
  const pax = Number(form.paxStaying) || 1;
  const exactRental = Number(form.exactRental) || 0;
  const depMul = unitCfg?.deposit_multiplier ?? 1.5;
  const adminFee = unitCfg?.admin_fee ?? 330;

  const accessFeesBreakdown = useMemo(() => {
    return chargeableAccess.map(a => ({
      label: `${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : a.chargeable_type === "processing_fee" ? "Processing Fee" : "Fee"})`,
      unitPrice: a.price,
      qty: pax,
      total: a.price * pax,
    }));
  }, [chargeableAccess, pax]);

  const carparkFeesBreakdown = useMemo(() => {
    const parkingCount = Number(form.parkingCount) || 0;
    return chargeableCarpark.map(a => ({
      label: `Car Park ${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`,
      unitPrice: a.price,
      qty: parkingCount,
      total: a.price * parkingCount,
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

  // Handle parking count change
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

  // Already selected car park IDs (to exclude from other dropdowns)
  const selectedCarParkIds = form.carParkSelections.map(s => s.roomId).filter(Boolean);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
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

    // Validate car park selections
    const parkingCount = Number(form.parkingCount) || 0;
    for (let i = 0; i < parkingCount; i++) {
      if (!form.carParkSelections[i]?.roomId) { toast.error(`Please select car park lot ${i + 1}`); return; }
      if (!form.carParkSelections[i]?.carPlate.trim()) { toast.error(`Please fill in car plate for parking ${i + 1}`); return; }
    }

    setSubmitting(true);
    try {
      const passportPaths = await Promise.all(uploadedFiles.passport.map(f => uploadFile(f, "passport")));
      const offerPaths = await Promise.all(uploadedFiles.offerLetter.map(f => uploadFile(f, "offer-letter")));
      const slipPaths = await Promise.all(uploadedFiles.transferSlip.map(f => uploadFile(f, "transfer-slip")));

      const moveInCost = {
        advance: exactRental,
        deposit,
        adminFee,
        accessFees: accessFeesBreakdown,
        carparkFees: carparkFeesBreakdown,
        carparkRental: carparkRentalTotal,
        totalAccessFees,
        totalCarparkFees,
        total: grandTotal,
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
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
        documents: {
          carParkSelections: form.carParkSelections.slice(0, parkingCount),
          ...(form.gender === "Couple" || form.gender === "2 Pax" ? {
            tenant2: {
              name: form.tenant2Name, phone: form.tenant2Phone, email: form.tenant2Email,
              icPassport: form.tenant2IcPassport,
              nationality: form.tenant2Nationality, occupation: form.tenant2Occupation,
            },
          } : {}),
        },
      });
      if (dbErr) throw dbErr;

      // Set room to Pending
      await supabase.from("rooms").update({ status: "Pending" }).eq("id", form.roomId);

      // Reserve selected car parks
      for (const sel of form.carParkSelections.slice(0, parkingCount)) {
        if (sel.roomId) {
          await supabase.from("rooms").update({
            status: "Pending",
            tenant_gender: `${form.tenantName} (${form.gender || ""})`,
          }).eq("id", sel.roomId);
        }
      }

      toast.success("Booking created successfully!");
      setForm(initialForm);
      setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (form.tenantName.trim() || form.roomId || form.agentId) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full text-sm";
  const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  const sectionTitle = (emoji: string, title: string) => (
    <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">{emoji} {title}</div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" hideClose>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Create Booking</DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-120px)]">
            <div className="space-y-5 py-4">
              {/* 1. Agent Selection */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {sectionTitle("👤", "Agent")}
                <div className="space-y-1">
                  <label className={lbl}>Search Agent</label>
                  <input className={ic} placeholder="Search by name or email..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={lbl}>Select Agent *</label>
                  <select className={ic} value={form.agentId} onChange={e => set("agentId", e.target.value)}>
                    <option value="">— Select Agent —</option>
                    {filteredAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.email}{a.name ? ` (${a.email})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Room Selection */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {sectionTitle("🏠", "Room")}
                <div className="space-y-1">
                  <label className={lbl}>Search Room</label>
                  <input className={ic} placeholder="Search by building, unit, room..." value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={lbl}>Select Room *</label>
                  <select className={ic} value={form.roomId} onChange={e => {
                    const room = roomsData.find(r => r.id === e.target.value);
                    setForm(prev => ({
                      ...prev,
                      roomId: e.target.value,
                      exactRental: room ? String(room.rent) : "",
                      parkingCount: "0",
                      carParkSelections: [],
                    }));
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
                      <label className={lbl}>Exact Rental (RM) *</label>
                      <input className={ic} type="number" placeholder="Agent's proposed rental" value={form.exactRental} onChange={e => set("exactRental", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>How many pax staying *</label>
                      <select className={ic} value={form.paxStaying} onChange={e => set("paxStaying", e.target.value)}>
                        {Array.from({ length: selectedRoom.max_pax || 4 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={String(n)}>{n} pax</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Tenancy Duration *</label>
                      <select className={ic} value={form.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)}>
                        {Array.from({ length: 24 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 24 ? " (2 years)" : m === 6 ? " (half year)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Move-in Date *</label>
                      <input className={ic} type="date" value={form.moveInDate} onChange={e => set("moveInDate", e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Access info from condo */}
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
                        <select className={ic} value={form.parkingCount} onChange={e => handleParkingCountChange(e.target.value)}>
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
                              <label className={lbl}>Search Car Park</label>
                              <input className={ic} placeholder="Search..." value={carParkSearch[i] || ""} onChange={e => setCarParkSearch(prev => ({ ...prev, [i]: e.target.value }))} />
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className={lbl}>Car Park Lot *</label>
                                <select className={ic} value={form.carParkSelections[i]?.roomId || ""} onChange={e => updateCarParkSelection(i, "roomId", e.target.value)}>
                                  <option value="">— Select Car Park —</option>
                                  {cpOptions.map(cp => (
                                    <option key={cp.id} value={cp.id}>{cp.room} — RM{cp.rent}/mo</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className={lbl}>Car Plate No *</label>
                                <input className={ic} placeholder="e.g. ABC1234" value={form.carParkSelections[i]?.carPlate || ""} onChange={e => updateCarParkSelection(i, "carPlate", e.target.value)} />
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

              {/* 4. Tenant Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {sectionTitle("👤", "Tenant Details")}

                {/* Existing tenant selector */}
                <div className="space-y-1">
                  <label className={lbl}>Link Existing Tenant (optional)</label>
                  <input className={ic} placeholder="Search by name, phone, email, IC..." value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} />
                  {tenantSearch.trim() && !isLinkedTenant && filteredTenants.length > 0 && (
                    <div className="border rounded-lg bg-background max-h-40 overflow-y-auto divide-y divide-border">
                      {filteredTenants.map(t => (
                        <button key={t.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedTenantId(t.id);
                            setTenantSearch("");
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
                          }}>
                          <span className="font-medium">{t.name}</span>
                          <span className="text-muted-foreground ml-2">{t.phone} · {t.email || t.ic_passport || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {tenantSearch.trim() && !isLinkedTenant && filteredTenants.length === 0 && (
                    <div className="text-xs text-muted-foreground py-1">No matching tenants found</div>
                  )}
                </div>

                {isLinkedTenant && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-2 text-sm">
                    <span className="font-semibold">Linked to existing tenant:</span> {form.tenantName}
                    <button type="button" className="ml-auto text-xs underline hover:no-underline" onClick={() => {
                      setSelectedTenantId(null);
                      setForm(prev => ({ ...prev, tenantName: "", phone: "", email: "", icPassport: "", gender: "", nationality: "", occupation: "",
                        emergency1Name: "", emergency1Phone: "", emergency1Relationship: "",
                        emergency2Name: "", emergency2Phone: "", emergency2Relationship: "" }));
                    }}>Unlink</button>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} placeholder="Full Name" value={form.tenantName} onChange={e => set("tenantName", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>NRIC/Passport No</label><input className={ic} placeholder="NRIC/Passport No" value={form.icPassport} onChange={e => set("icPassport", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" placeholder="Email" value={form.email} onChange={e => set("email", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} placeholder="Contact No" value={form.phone} onChange={e => set("phone", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Gender *</label>
                    <select className={ic} value={form.gender} onChange={e => set("gender", e.target.value)} disabled={isLinkedTenant}>
                      <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Couple</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className={lbl}>Nationality</label><input className={ic} placeholder="Nationality" value={form.nationality} onChange={e => set("nationality", e.target.value)} disabled={isLinkedTenant} /></div>
                  <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} placeholder="Occupation" value={form.occupation} onChange={e => set("occupation", e.target.value)} disabled={isLinkedTenant} /></div>
                </div>

                {form.gender === "Couple" && (
                  <div className="mt-3 p-3 border border-dashed border-primary/30 rounded-lg space-y-3">
                    <div className="text-sm font-bold flex items-center gap-2">👥 Second Tenant Details</div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1"><label className={lbl}>Full Name</label><input className={ic} placeholder="Full Name" value={form.tenant2Name} onChange={e => set("tenant2Name", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>NRIC/Passport No</label><input className={ic} placeholder="NRIC/Passport No" value={form.tenant2IcPassport} onChange={e => set("tenant2IcPassport", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" placeholder="Email" value={form.tenant2Email} onChange={e => set("tenant2Email", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Contact No</label><input className={ic} placeholder="Contact No" value={form.tenant2Phone} onChange={e => set("tenant2Phone", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Nationality</label><input className={ic} placeholder="Nationality" value={form.tenant2Nationality} onChange={e => set("tenant2Nationality", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} placeholder="Occupation" value={form.tenant2Occupation} onChange={e => set("tenant2Occupation", e.target.value)} /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Emergency Contacts */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {sectionTitle("🚨", "Emergency Contacts")}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 1 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><input className={ic} placeholder="Name" value={form.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><input className={ic} placeholder="Phone" value={form.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><input className={ic} placeholder="e.g. Father" value={form.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} disabled={isLinkedTenant} /></div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 2 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><input className={ic} placeholder="Name" value={form.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><input className={ic} placeholder="Phone" value={form.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} disabled={isLinkedTenant} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><input className={ic} placeholder="e.g. Spouse" value={form.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} disabled={isLinkedTenant} /></div>
                  </div>
                </div>
              </div>

              {/* 6. Documents */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {sectionTitle("📎", "Documents")}
                {([
                  { key: "passport" as const, label: "Passport / IC" },
                  { key: "offerLetter" as const, label: "Offer Letter" },
                  { key: "transferSlip" as const, label: "Transfer Slip" },
                ]).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className={lbl}>{label}</label>
                    <div className="flex items-center gap-3">
                      <label className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                        Choose Files
                        <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => {
                          if (e.target.files) setUploadedFiles(prev => ({ ...prev, [key]: [...prev[key], ...Array.from(e.target.files!)] }));
                        }} />
                      </label>
                      <span className="text-xs text-muted-foreground">{uploadedFiles[key].length > 0 ? uploadedFiles[key].map(f => f.name).join(", ") : "No file chosen"}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 7. Move-in Cost — Bill style */}
              {selectedRoom && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  {sectionTitle("💰", "Move-in Cost")}
                  <div className="bg-background rounded-lg border divide-y divide-border">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                      <span>Description</span>
                      <span className="text-right">Amount (RM)</span>
                    </div>

                    {/* Advance Rental */}
                    <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                      <span>1 Month Advance Rental</span>
                      <span className="text-right font-medium">{exactRental.toLocaleString()}</span>
                    </div>

                    {/* Rental Deposit */}
                    <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                      <span>Rental Deposit (×{depMul})</span>
                      <span className="text-right font-medium">{deposit.toLocaleString()}</span>
                    </div>

                    {/* Admin Fee */}
                    <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                      <span>Admin Fee</span>
                      <span className="text-right font-medium">{adminFee.toLocaleString()}</span>
                    </div>

                    {/* Access fees */}
                    {accessFeesBreakdown.map((f, i) => (
                      <div key={`access-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                        <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                        <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                      </div>
                    ))}

                    {/* Car park fees */}
                    {carparkFeesBreakdown.map((f, i) => (
                      <div key={`cp-${i}`} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                        <span>{f.label} <span className="text-muted-foreground">({f.qty} × RM{f.unitPrice})</span></span>
                        <span className="text-right font-medium">{f.total.toLocaleString()}</span>
                      </div>
                    ))}

                    {/* Car park advance rental */}
                    {carparkRentalTotal > 0 && (
                      <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm">
                        <span>1 Month Advance Car Park Rental</span>
                        <span className="text-right font-medium">{carparkRentalTotal.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="grid grid-cols-[1fr_auto] px-4 py-3 bg-primary/5">
                      <span className="font-bold">Total Move-in Cost</span>
                      <span className="text-right font-bold text-lg">RM {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Create Booking"}</Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Discard confirm */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel? Your unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onOpenChange(false); setShowDiscardConfirm(false); setForm(initialForm); setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] }); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

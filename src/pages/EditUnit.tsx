import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUnits, useUpdateUnit, useUpdateRoom, useCreateRoom, useDeleteRoom, Room, Unit } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { logActivity } from "@/hooks/useActivityLog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { StandardModal } from "@/components/ui/standard-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/lib/ui-constants";
import { Plus, Pencil, Eye, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

const OPTIONAL_FEATURES = ["Balcony", "Private Bathroom", "Window"];
const bedTypeMaxPax: Record<string, number> = { Single: 1, "Super Single": 1, Queen: 2, King: 2 };

interface EditUnitProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  focusRoomId?: string;
}

export default function EditUnit({ open, onOpenChange, unitId, focusRoomId }: EditUnitProps) {
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();
  const { data: condosList = [] } = useCondos();
  const updateUnit = useUpdateUnit();
  const updateRoomMut = useUpdateRoom();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();

  const unit = units.find(u => u.id === unitId);

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomEdits, setRoomEdits] = useState<Record<string, Record<string, any>>>({});
  const [accordionValue, setAccordionValue] = useState<string[]>(["unit-info", "rooms", "carparks"]);
  const { errors, validate, clearError } = useFormValidation();

  useEffect(() => {
    if (unit && !form) {
      setForm({
        building: unit.building, location: unit.location, unit: unit.unit,
        unit_type: unit.unit_type, unit_max_pax: unit.unit_max_pax,
        deposit_multiplier: (unit as any).deposit_multiplier ?? 1.5,
        admin_fee: (unit as any).admin_fee ?? 330,
        meter_type: (unit as any).meter_type || "Postpaid",
        meter_rate: (unit as any).meter_rate ?? 0.65,
        passcode: unit.passcode || "",
        wifi_name: (unit as any).wifi_name || "",
        wifi_password: (unit as any).wifi_password || "",
        internal_only: (unit as any).internal_only || false,
        common_photos: (unit as any).common_photos || [],
      });
    }
  }, [unit]);

  useEffect(() => {
    if (!open) { setForm(null); setRoomEdits({}); setEditingRoomId(null); setAccordionValue(["unit-info", "rooms", "carparks"]); }
  }, [open]);

  useEffect(() => {
    if (focusRoomId && open) {
      setEditingRoomId(focusRoomId);
      setTimeout(() => {
        const el = document.getElementById(`room-card-${focusRoomId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [focusRoomId, open, unit]);

  const rooms = useMemo(() => (unit?.rooms || []).filter(r => (r as any).room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark")), [unit]);
  const carparks = useMemo(() => (unit?.rooms || []).filter(r => (r as any).room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark")), [unit]);

  const getRoomData = (room: Room) => roomEdits[room.id] ? { ...room, ...roomEdits[room.id] } : room;
  const updateRoomField = (roomId: string, field: string, value: any) => {
    setRoomEdits(prev => ({ ...prev, [roomId]: { ...prev[roomId], [field]: value } }));
  };

  const isDirty = Object.keys(roomEdits).some(k => Object.keys(roomEdits[k]).length > 0);

  if (!open) return null;

  if (isLoading || !form) {
    return (
      <StandardModal open={open} onOpenChange={onOpenChange} title="Edit Unit" size="xl">
        <div className="flex items-center justify-center py-12"><span className="text-muted-foreground">Loading…</span></div>
      </StandardModal>
    );
  }
  if (!unit) {
    return (
      <StandardModal open={open} onOpenChange={onOpenChange} title="Edit Unit" size="xl">
        <div className="flex items-center justify-center py-12"><span className="text-muted-foreground">Unit not found.</span></div>
      </StandardModal>
    );
  }

  const updateField = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleSave = async () => {
    const rules: Record<string, (v: any) => string | null> = {
      building: () => !form.building?.trim() ? "Building is required" : null,
      unit: () => !form.unit?.trim() ? "Unit Number is required" : null,
    };
    if (!validate(form, rules)) return;
    if (editingRoomId) { toast.error("Please save or cancel the room you're editing first."); return; }
    setSaving(true);
    try {
      const { common_photos, ...rest } = form;
      await updateUnit.mutateAsync({ id: unit.id, ...rest, common_photos } as any);
      for (const [roomId, edits] of Object.entries(roomEdits)) {
        if (Object.keys(edits).length > 0) {
          const room = [...rooms, ...carparks].find(r => r.id === roomId);
          if (room) await updateRoomMut.mutateAsync({ ...room, ...edits } as any);
        }
      }
      logActivity("update_unit", "unit", unit.id, { building: form.building, unit: form.unit });
      toast.success("Unit updated successfully.");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const saveInlineRoom = (roomId: string) => {
    const edits = roomEdits[roomId];
    const room = [...rooms, ...carparks].find(r => r.id === roomId);
    if (!room) return;
    const rc = { ...room, ...edits };
    const isCarpark = (rc as any).room_type === "Car Park";
    if (!isCarpark && (rc as any).room_category !== "Studio" && !(rc as any).bed_type?.trim()) {
      toast.error("Bed Type is required."); return;
    }
    if (rc.status === "Available Soon" && !rc.available_date?.trim()) {
      toast.error("Available Date is required when setting status to Available Soon."); return;
    }
    setEditingRoomId(null);
  };

  const cancelInlineRoom = (roomId: string) => {
    setRoomEdits(prev => { const next = { ...prev }; delete next[roomId]; return next; });
    setEditingRoomId(null);
  };

  const getNextRoomName = () => {
    const existingNames = rooms.map(r => r.room);
    const hasAlpha = existingNames.some(n => /Room [A-Z]$/.test(n));
    if (hasAlpha) {
      const usedLetters = existingNames.map(n => n.replace("Room ", "")).filter(l => l.length === 1 && /[A-Z]/.test(l));
      for (let i = 0; i < 26; i++) { const letter = String.fromCharCode(65 + i); if (!usedLetters.includes(letter)) return `Room ${letter}`; }
      return `Room ${rooms.length + 1}`;
    }
    const usedNums = existingNames.map(n => parseInt(n.replace("Room ", ""))).filter(n => !isNaN(n));
    let next = 1; while (usedNums.includes(next)) next++; return `Room ${next}`;
  };

  const getNextCarparkName = () => {
    const usedNums = carparks.map(cp => parseInt(cp.room.replace("Carpark ", ""))).filter(n => !isNaN(n));
    let next = 1; while (usedNums.includes(next)) next++; return `Carpark ${next}`;
  };

  const handleAddRoom = async () => {
    try {
      await createRoom.mutateAsync({
        room: getNextRoomName(), room_title: "", unit_id: unit.id, building: unit.building, unit: unit.unit,
        location: unit.location, rent: 0, room_type: "Normal Room", room_category: "Normal Room",
        unit_type: unit.unit_type, status: "Available", available_date: "", max_pax: 1,
        occupied_pax: 0, unit_max_pax: unit.unit_max_pax, unit_occupied_pax: 0,
        housemates: [], photos: [], access_info: "",
        move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
        bed_type: "", pax_staying: 0, tenant_gender: "", tenant_race: "",
        internal_only: (unit as any).internal_only || false, wall_type: "", optional_features: [], internal_remark: "",
      } as any);
      toast.success("Room added.");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddCarpark = async () => {
    try {
      await createRoom.mutateAsync({
        room: getNextCarparkName(), unit_id: unit.id, building: unit.building, unit: unit.unit,
        location: unit.location, rent: 150, room_type: "Car Park", unit_type: unit.unit_type,
        status: "Available", available_date: "", max_pax: 0, occupied_pax: 0,
        unit_max_pax: unit.unit_max_pax, unit_occupied_pax: 0, housemates: [], photos: [],
        access_info: "", move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
        bed_type: "", pax_staying: 0, tenant_gender: "", tenant_race: "",
        internal_only: false, parking_lot: "", assigned_to: "", internal_remark: "",
      } as any);
      toast.success("Carpark added.");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <StandardModal
        open={open} onOpenChange={onOpenChange}
        title={`Edit Unit — ${unit.building} · ${unit.unit}`}
        size="xl" isDirty={isDirty}
        footer={<Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
      >
        <FormErrorBanner errors={errors} />
        <div className="flex justify-end mb-2">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="text-xs bg-card" onClick={() => setAccordionValue(["unit-info", "rooms", "carparks"])}>Expand All</Button>
            <Button variant="outline" size="sm" className="text-xs bg-card" onClick={() => setAccordionValue([])}>Collapse All</Button>
          </div>
        </div>
        <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-2">
          {/* ── Unit Information ── */}
          <AccordionItem value="unit-info" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Unit Information</span>
                <span className="text-xs text-muted-foreground">— {form.building} · {form.unit}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5 pb-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common Area Photos</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {(form.common_photos || []).map((path: string, i: number) => (
                      <div key={i} className="relative group">
                        <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-20 w-20 object-cover rounded-lg" />
                        <button onClick={() => updateField("common_photos", form.common_photos.filter((_: any, idx: number) => idx !== i))}
                          className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    {(form.common_photos || []).length < 10 && (
                      <label className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                        <span className="text-xl text-muted-foreground">+</span>
                        <span className="text-[10px] text-muted-foreground">Add</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const remaining = 10 - (form.common_photos || []).length;
                          const toUpload = files.slice(0, remaining);
                          const newPaths: string[] = [];
                          for (const file of toUpload) {
                            const ext = file.name.split('.').pop();
                            const path = `common/${unit.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                            const { error } = await supabase.storage.from("room-photos").upload(path, file);
                            if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
                            newPaths.push(path);
                          }
                          if (newPaths.length > 0) updateField("common_photos", [...(form.common_photos || []), ...newPaths]);
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div data-field="building">
                    <Label className="text-xs text-muted-foreground">Building *</Label>
                    <select className={fieldClass(`${inputClass} w-full`, !!errors.building)} value={form.building} onChange={e => {
                      const condo = condosList.find(c => c.name === e.target.value);
                      setForm((prev: any) => ({ ...prev, building: e.target.value, location: condo?.location?.name || prev.location }));
                      clearError("building");
                    }}>
                      <option value="">— Select Building —</option>
                      {condosList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <FieldError error={errors.building} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={form.location} readOnly />
                  </div>
                  <div data-field="unit">
                    <Label className="text-xs text-muted-foreground">Unit Number *</Label>
                    <input className={fieldClass(`${inputClass} w-full`, !!errors.unit)} value={form.unit} onChange={e => { updateField("unit", e.target.value); clearError("unit"); }} />
                    <FieldError error={errors.unit} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Unit Type *</Label>
                    <select className={`${inputClass} w-full`} value={form.unit_type} onChange={e => updateField("unit_type", e.target.value)}>
                      <option value="Mix Unit">Mixed</option>
                      <option value="Female Unit">Female</option>
                      <option value="Male Unit">Male</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Maximum Occupants *</Label>
                    <input className={`${inputClass} w-full`} type="number" min={1} value={form.unit_max_pax} onChange={e => updateField("unit_max_pax", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Rental Deposit (Months)</Label>
                    <input className={`${inputClass} w-full`} type="number" step="0.1" value={form.deposit_multiplier} onChange={e => updateField("deposit_multiplier", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Admin Fee (RM)</Label>
                    <input className={`${inputClass} w-full`} type="number" value={form.admin_fee} onChange={e => updateField("admin_fee", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Meter Type</Label>
                    <select className={`${inputClass} w-full`} value={form.meter_type} onChange={e => updateField("meter_type", e.target.value)}>
                      <option value="Prepaid">Prepaid</option>
                      <option value="Postpaid">Postpaid</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Meter Rate (RM per kWh)</Label>
                    <input className={`${inputClass} w-full`} type="number" step="0.01" value={form.meter_rate || ""} onChange={e => updateField("meter_rate", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Main Door Passcode</Label>
                    <input className={`${inputClass} w-full`} value={form.passcode} onChange={e => updateField("passcode", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">WiFi Name</Label>
                    <input className={`${inputClass} w-full`} value={form.wifi_name} onChange={e => updateField("wifi_name", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                    <input className={`${inputClass} w-full`} value={form.wifi_password} onChange={e => updateField("wifi_password", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Checkbox id="editInternalOnly" checked={form.internal_only} onCheckedChange={(checked) => updateField("internal_only", !!checked)} />
                  <label htmlFor="editInternalOnly" className="text-sm font-medium cursor-pointer">🔒 Internal Only — Hidden from External Agent</label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Rooms ── */}
          <AccordionItem value="rooms" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-semibold">Rooms</span>
                <span className="text-xs text-muted-foreground">— {rooms.length} rooms</span>
              </div>
              <Button size="sm" className="mr-2" onClick={(e) => { e.stopPropagation(); handleAddRoom(); }}><Plus className="h-4 w-4 mr-1" /> Add Room</Button>
            </AccordionTrigger>
            <AccordionContent>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No rooms configured.</p>
              ) : (
                <div className="space-y-2 pb-2">
                  {rooms.map(room => {
                    const rc = getRoomData(room);
                    const isEditing = editingRoomId === room.id;
                    const upRoom = (field: string, value: any) => updateRoomField(room.id, field, value);
                    const features = Array.isArray((rc as any).optional_features) ? (rc as any).optional_features : [];
                    const showAvailDate = rc.status === "Available Soon";

                    if (!isEditing) {
                      return (
                        <div key={room.id} id={`room-card-${room.id}`} className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
                          <div className="flex items-center gap-3 text-sm">
                            <Badge variant="outline" className="font-mono">{rc.room}</Badge>
                            <span className="font-medium">{(rc as any).room_title || <span className="text-muted-foreground italic">No title</span>}</span>
                            <span className="font-medium">RM{rc.rent || 0}</span>
                            <StatusBadge status={rc.status || "Available"} />
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditingRoomId(room.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteConfirmRoom(room.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={room.id} id={`room-card-${room.id}`} className="rounded-lg border bg-card p-4 space-y-3 border-primary/30">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{rc.room}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => cancelInlineRoom(room.id)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                            <Button size="sm" onClick={() => saveInlineRoom(room.id)}><Check className="h-4 w-4 mr-1" /> Done</Button>
                          </div>
                        </div>

                        {/* Room Photos */}
                        <div>
                          <label className="text-xs text-muted-foreground">Room Photos</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {((rc as any).photos || []).map((path: string, pi: number) => (
                              <div key={pi} className="relative group">
                                <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Room ${pi + 1}`} className="h-16 w-16 object-cover rounded-lg" />
                                <button onClick={() => upRoom("photos", ((rc as any).photos || []).filter((_: any, idx: number) => idx !== pi))}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                            {((rc as any).photos || []).length < 10 && (
                              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                <span className="text-lg text-muted-foreground">+</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  const remaining = 10 - ((rc as any).photos || []).length;
                                  const toUpload = files.slice(0, remaining);
                                  const newPaths: string[] = [];
                                  for (const file of toUpload) {
                                    const ext = file.name.split('.').pop();
                                    const path = `rooms/${room.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                                    if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
                                    newPaths.push(path);
                                  }
                                  if (newPaths.length > 0) upRoom("photos", [...((rc as any).photos || []), ...newPaths]);
                                  e.target.value = "";
                                }} />
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Room Code</label>
                            <input className={`${inputClass} w-full`} value={rc.room} onChange={e => upRoom("room", e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-muted-foreground">Room Title</label>
                            <input className={`${inputClass} w-full`} placeholder="e.g. Balcony Queen Room" value={(rc as any).room_title || ""} onChange={e => upRoom("room_title", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Room Type</label>
                            <select className={`${inputClass} w-full`} value={(rc as any).room_category || "Normal Room"} onChange={e => {
                              upRoom("room_category", e.target.value);
                              if (e.target.value === "Studio") upRoom("bed_type", "None");
                              else if ((rc as any).bed_type === "None") upRoom("bed_type", "");
                            }}>
                              <option value="Normal Room">Room</option>
                              <option value="Studio">Studio</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Bed Type</label>
                            <select className={`${inputClass} w-full`} value={(rc as any).bed_type || ""} onChange={e => {
                              const bt = e.target.value;
                              upRoom("bed_type", bt);
                              if (bt !== "None" && bedTypeMaxPax[bt]) upRoom("max_pax", bedTypeMaxPax[bt]);
                            }}>
                              <option value="">—</option>
                              <option value="None">None</option>
                              <option value="Single">Single</option>
                              <option value="Super Single">Super Single</option>
                              <option value="Queen">Queen</option>
                              <option value="King">King</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Wall Type</label>
                            <select className={`${inputClass} w-full`} value={(rc as any).wall_type || ""} onChange={e => upRoom("wall_type", e.target.value)}>
                              <option value="">—</option>
                              <option value="Original">Original</option>
                              <option value="Partition">Partition</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Max Pax *</label>
                            <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => upRoom("max_pax", Number(e.target.value))} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Listed Rental (RM) *</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => upRoom("rent", Number(e.target.value))} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Status</label>
                            {rc.status === "Pending" || rc.status === "Available Soon" ? (
                              <>
                                <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={rc.status} readOnly disabled />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {rc.status === "Pending" ? "This status is controlled by Booking workflow." : "This status is controlled by Move Out workflow."}
                                </p>
                              </>
                            ) : (
                              <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => {
                                upRoom("status", e.target.value);
                                if (e.target.value === "Available Soon" && !rc.available_date) upRoom("available_date", "");
                              }}>
                                {rc.status === "Available" && (
                                  <>
                                    <option value="Available">Available</option>
                                    <option value="Archived">Archived</option>
                                  </>
                                )}
                                {rc.status === "Occupied" && (
                                  <>
                                    <option value="Occupied">Occupied</option>
                                    <option value="Available Soon">Available Soon</option>
                                  </>
                                )}
                                {rc.status === "Archived" && (
                                  <>
                                    <option value="Archived">Archived</option>
                                    <option value="Available">Available</option>
                                  </>
                                )}
                              </select>
                            )}
                            {rc.status === "Occupied" && <p className="text-xs text-muted-foreground mt-1">Only &quot;Available Soon&quot; transition allowed here. Full release via Move Out workflow.</p>}
                          </div>
                          {showAvailDate && (
                            <div>
                              <label className="text-xs text-muted-foreground">Available Date</label>
                              <input className={`${inputClass} w-full`} type="date" value={rc.available_date || ""} onChange={e => upRoom("available_date", e.target.value)} />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground block mb-1.5">Features</label>
                          <div className="flex flex-wrap gap-2">
                            {OPTIONAL_FEATURES.map(feat => {
                              const selected = features.includes(feat);
                              return (
                                <button key={feat} type="button"
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-accent"}`}
                                  onClick={() => upRoom("optional_features", selected ? features.filter((f: string) => f !== feat) : [...features, feat])}
                                >{feat}</button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground">Remark</label>
                          <input className={`${inputClass} w-full`} placeholder="Internal notes…" value={(rc as any).internal_remark || ""} onChange={e => upRoom("internal_remark", e.target.value)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── Carparks ── */}
          <AccordionItem value="carparks" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-semibold">Carparks</span>
                <span className="text-xs text-muted-foreground">— {carparks.length} carparks</span>
              </div>
              <Button size="sm" className="mr-2" onClick={(e) => { e.stopPropagation(); handleAddCarpark(); }}><Plus className="h-4 w-4 mr-1" /> Add Carpark</Button>
            </AccordionTrigger>
            <AccordionContent>
              {carparks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No carparks configured.</p>
              ) : (
                <div className="space-y-2 pb-2">
                  {carparks.map(cp => {
                    const rc = getRoomData(cp);
                    const isEditing = editingRoomId === cp.id;
                    const upCP = (field: string, value: any) => updateRoomField(cp.id, field, value);

                    if (!isEditing) {
                      return (
                        <div key={cp.id} className="rounded-lg border bg-accent/30 px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium">🅿️ {rc.room}</span>
                            {(rc as any).parking_lot && <span className="text-muted-foreground">{(rc as any).parking_lot}</span>}
                            <span className="font-medium">RM{rc.rent || 0}</span>
                            <StatusBadge status={rc.status || "Available"} />
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditingRoomId(cp.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteConfirmRoom(cp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={cp.id} className="rounded-lg border bg-accent/30 border-primary/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">🅿️ {rc.room}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => cancelInlineRoom(cp.id)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                            <Button size="sm" onClick={() => saveInlineRoom(cp.id)}><Check className="h-4 w-4 mr-1" /> Done</Button>
                          </div>
                        </div>
                        {/* Carpark Photos */}
                        <div>
                          <label className="text-xs text-muted-foreground">Photos</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {((rc as any).photos || []).map((path: string, pi: number) => (
                              <div key={pi} className="relative group">
                                <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Carpark ${pi + 1}`} className="h-16 w-16 object-cover rounded-lg" />
                                <button onClick={() => upCP("photos", ((rc as any).photos || []).filter((_: any, idx: number) => idx !== pi))}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                            {((rc as any).photos || []).length < 10 && (
                              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                <span className="text-lg text-muted-foreground">+</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  const remaining = 10 - ((rc as any).photos || []).length;
                                  const toUpload = files.slice(0, remaining);
                                  const newPaths: string[] = [];
                                  for (const file of toUpload) {
                                    const ext = file.name.split('.').pop();
                                    const path = `rooms/${cp.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                                    if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
                                    newPaths.push(path);
                                  }
                                  if (newPaths.length > 0) upCP("photos", [...((rc as any).photos || []), ...newPaths]);
                                  e.target.value = "";
                                }} />
                              </label>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Lot Number</label>
                            <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={(rc as any).parking_lot || ""} onChange={e => upCP("parking_lot", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Rental (RM)</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => upCP("rent", Number(e.target.value))} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Status</label>
                            {rc.status === "Pending" || rc.status === "Available Soon" ? (
                              <>
                                <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={rc.status} readOnly disabled />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {rc.status === "Pending" ? "This status is controlled by Booking workflow." : "This status is controlled by Move Out workflow."}
                                </p>
                              </>
                            ) : (
                              <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => {
                                upCP("status", e.target.value);
                                if (e.target.value === "Available Soon" && !rc.available_date) upCP("available_date", "");
                              }}>
                                {rc.status === "Available" && (
                                  <>
                                    <option value="Available">Available</option>
                                    <option value="Archived">Archived</option>
                                  </>
                                )}
                                {rc.status === "Occupied" && (
                                  <>
                                    <option value="Occupied">Occupied</option>
                                    <option value="Available Soon">Available Soon</option>
                                  </>
                                )}
                                {rc.status === "Archived" && (
                                  <>
                                    <option value="Archived">Archived</option>
                                    <option value="Available">Available</option>
                                  </>
                                )}
                              </select>
                            )}
                            {rc.status === "Occupied" && <p className="text-xs text-muted-foreground mt-1">Only &quot;Available Soon&quot; transition allowed here. Full release via Move Out workflow.</p>}
                          </div>
                          {rc.status === "Available Soon" && (
                            <div>
                              <label className="text-xs text-muted-foreground">Available Date *</label>
                              <input className={`${inputClass} w-full`} type="date" value={rc.available_date || ""} onChange={e => upCP("available_date", e.target.value)} />
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-muted-foreground">Remark</label>
                            <input className={`${inputClass} w-full`} placeholder="Notes…" value={(rc as any).internal_remark || ""} onChange={e => upCP("internal_remark", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </StandardModal>

      <ConfirmDialog
        open={!!deleteConfirmRoom}
        onOpenChange={(open) => { if (!open) setDeleteConfirmRoom(null); }}
        title="Remove this item?"
        description="This action cannot be undone. The room or carpark will be permanently deleted."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (deleteConfirmRoom) {
            try { await deleteRoom.mutateAsync(deleteConfirmRoom); toast.success("Removed."); } catch (e: any) { toast.error(e.message); }
          }
          setDeleteConfirmRoom(null);
        }}
      />
    </>
  );
}

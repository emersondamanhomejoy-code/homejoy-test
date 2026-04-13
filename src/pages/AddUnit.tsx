import { useState } from "react";
import { useCondos } from "@/hooks/useCondos";
import { useCreateUnit, RoomConfig } from "@/hooks/useRooms";
import { logActivity } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StandardModal } from "@/components/ui/standard-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/lib/ui-constants";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

const bedTypeMaxPax: Record<string, number> = {
  Single: 1, "Super Single": 1, Queen: 2, King: 2,
};
const OPTIONAL_FEATURES = ["Balcony", "Private Bathroom", "Window"];

interface LocalRoom extends RoomConfig {
  room_title: string;
  _editing: boolean;
  _key: number;
}

interface LocalCarpark {
  room: string;
  parking_lot: string;
  rent: number;
  status: string;
  assigned_to: string;
  internal_remark: string;
  _editing: boolean;
  _key: number;
}

let keyCounter = 0;

interface AddUnitProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddUnit({ open, onOpenChange }: AddUnitProps) {
  const { data: condosList = [] } = useCondos();
  const createUnit = useCreateUnit();

  const [form, setForm] = useState({
    building: "", location: "", unit: "", unit_type: "Mix Unit",
    unit_max_pax: 6, deposit_multiplier: 1.5, admin_fee: 330,
    meter_type: "Postpaid", meter_rate: 0.65, passcode: "",
    wifi_name: "", wifi_password: "", internal_only: false,
    common_photos: [] as string[],
  });

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const [roomRecords, setRoomRecords] = useState<LocalRoom[]>([]);
  const [carparkRecords, setCarparkRecords] = useState<LocalCarpark[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "room" | "carpark"; key: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Room helpers ──
  const getNextRoomLabel = () => {
    const usedLetters = roomRecords.map(r => r.room.replace("Room ", "")).filter(l => l.length === 1 && /[A-Z]/.test(l));
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!usedLetters.includes(letter)) return `Room ${letter}`;
    }
    return `Room ${roomRecords.length + 1}`;
  };

  const addRoom = () => {
    setRoomRecords(prev => [...prev, {
      room: getNextRoomLabel(), room_title: "", bed_type: "", max_pax: 1, rent: 0, status: "Available",
      room_category: "Normal Room", wall_type: "", optional_features: [], internal_remark: "",
      available_date: "", photos: [],
      _editing: true, _key: ++keyCounter,
    }]);
  };

  const updateRoom = (key: number, field: string, value: any) => {
    setRoomRecords(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
  };

  const saveRoom = (key: number) => {
    const room = roomRecords.find(r => r._key === key);
    if (!room) return;
    if (room.room_category !== "Studio" && !room.bed_type.trim()) { alert("Bed Type is required."); return; }
    if (!room.rent || room.rent <= 0) { alert("Rent must be greater than 0."); return; }
    setRoomRecords(prev => prev.map(r => r._key === key ? { ...r, _editing: false } : r));
  };

  const cancelRoomEdit = (key: number) => {
    const room = roomRecords.find(r => r._key === key);
    if (!room) return;
    // If never saved (no rent set), remove it
    if (room.rent <= 0 && !room.bed_type) {
      setRoomRecords(prev => prev.filter(r => r._key !== key));
    } else {
      setRoomRecords(prev => prev.map(r => r._key === key ? { ...r, _editing: false } : r));
    }
  };

  // ── Carpark helpers ──
  const getNextCarparkLabel = () => {
    const usedNums = carparkRecords.map(c => parseInt(c.room.replace("Carpark ", ""))).filter(n => !isNaN(n));
    let next = 1;
    while (usedNums.includes(next)) next++;
    return `Carpark ${next}`;
  };

  const addCarpark = () => {
    setCarparkRecords(prev => [...prev, {
      room: getNextCarparkLabel(), parking_lot: "", rent: 150, status: "Available",
      assigned_to: "", internal_remark: "",
      _editing: true, _key: ++keyCounter,
    }]);
  };

  const updateCarpark = (key: number, field: string, value: any) => {
    setCarparkRecords(prev => prev.map(c => c._key === key ? { ...c, [field]: value } : c));
  };

  const saveCarpark = (key: number) => {
    setCarparkRecords(prev => prev.map(c => c._key === key ? { ...c, _editing: false } : c));
  };

  const cancelCarparkEdit = (key: number) => {
    const cp = carparkRecords.find(c => c._key === key);
    if (!cp) return;
    if (!cp.parking_lot && cp.rent === 150 && cp.status === "Available") {
      setCarparkRecords(prev => prev.filter(c => c._key !== key));
    } else {
      setCarparkRecords(prev => prev.map(c => c._key === key ? { ...c, _editing: false } : c));
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "room") {
      setRoomRecords(prev => prev.filter(r => r._key !== deleteConfirm.key));
    } else {
      setCarparkRecords(prev => prev.filter(c => c._key !== deleteConfirm.key));
    }
    setDeleteConfirm(null);
  };

  // ── Save ──
  const saveUnit = async () => {
    const missingFields: string[] = [];
    if (!form.building.trim()) missingFields.push("Building");
    if (!form.location.trim()) missingFields.push("Location");
    if (!form.unit.trim()) missingFields.push("Unit Number");
    if (!Number.isFinite(form.unit_max_pax) || form.unit_max_pax < 1) missingFields.push("Maximum Occupants");

    const editingRooms = roomRecords.filter(r => r._editing);
    if (editingRooms.length > 0) { alert("Please save or cancel all room entries before saving the unit."); return; }
    const editingCPs = carparkRecords.filter(c => c._editing);
    if (editingCPs.length > 0) { alert("Please save or cancel all carpark entries before saving the unit."); return; }

    if (missingFields.length > 0) {
      alert(`Please complete the required fields:\n• ${missingFields.join("\n• ")}`);
      return;
    }

    setSaving(true);
    try {
      const { common_photos, wifi_name, wifi_password, ...unitData } = form;
      const allConfigs: RoomConfig[] = [
        ...roomRecords.map(({ _editing, _key, room_title, ...r }) => ({ ...r, room_title })),
        ...carparkRecords.map(({ _editing, _key, ...c }) => ({
          room: c.room, bed_type: "", max_pax: 0, rent: c.rent,
          room_type: "Car Park" as const, status: c.status,
          assigned_to: c.assigned_to, internal_remark: c.internal_remark,
          parking_lot: c.parking_lot,
        })),
      ];
      await createUnit.mutateAsync({
        unit: { ...unitData, common_photos, wifi_name, wifi_password, access_info: "" } as any,
        roomConfigs: allConfigs,
      });
      logActivity("create_unit", "unit", "", { building: form.building, unit: form.unit });
      onOpenChange(false);
    } catch (e: any) {
      alert(e.message || "Failed to save unit");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !!(form.building || form.unit || roomRecords.length > 0 || carparkRecords.length > 0);

  return (
    <>
      <StandardModal
        open={open}
        onOpenChange={onOpenChange}
        title="Add Unit"
        size="xl"
        isDirty={isDirty}
        footer={
          <Button onClick={saveUnit} disabled={saving}>
            {saving ? "Saving..." : "Save Unit & Rooms"}
          </Button>
        }
      >
        <div className="space-y-8">
          {/* ── Unit Information ── */}
          <section className="space-y-5">
            <h2 className="text-lg font-semibold border-b border-border pb-2">Unit Information</h2>

            {/* Common Area Photos */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common Area Photos</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {form.common_photos.map((path, i) => (
                  <div key={i} className="relative group">
                    <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-20 w-20 object-cover rounded-lg" />
                    <button onClick={() => updateField("common_photos", form.common_photos.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
                {form.common_photos.length < 10 && (
                  <label className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-xl text-muted-foreground">+</span>
                    <span className="text-[10px] text-muted-foreground">Add</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const remaining = 10 - form.common_photos.length;
                      const toUpload = files.slice(0, remaining);
                      const newPaths: string[] = [];
                      for (const file of toUpload) {
                        const ext = file.name.split('.').pop();
                        const path = `common/temp_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                        const { error } = await supabase.storage.from("room-photos").upload(path, file);
                        if (error) { alert(`Upload failed: ${error.message}`); continue; }
                        newPaths.push(path);
                      }
                      if (newPaths.length > 0) updateField("common_photos", [...form.common_photos, ...newPaths]);
                      e.target.value = "";
                    }} />
                  </label>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Building *</Label>
                <select className={`${inputClass} w-full`} value={form.building} onChange={e => {
                  const condo = condosList.find(c => c.name === e.target.value);
                  setForm(prev => ({ ...prev, building: e.target.value, location: condo?.location?.name || "" }));
                }}>
                  <option value="">— Select Building —</option>
                  {condosList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Location *</Label>
                <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={form.location} readOnly placeholder="Select a building above" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit Number *</Label>
                <input className={`${inputClass} w-full`} placeholder="e.g. A-17-8" value={form.unit} onChange={e => updateField("unit", e.target.value)} />
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
                <Label className="text-xs text-muted-foreground">Rental Deposit (Months) *</Label>
                <input className={`${inputClass} w-full`} type="number" step="0.1" placeholder="e.g. 1.5" value={form.deposit_multiplier} onChange={e => updateField("deposit_multiplier", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Admin Fee (RM) *</Label>
                <input className={`${inputClass} w-full`} type="number" value={form.admin_fee} onChange={e => updateField("admin_fee", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meter Type *</Label>
                <select className={`${inputClass} w-full`} value={form.meter_type} onChange={e => updateField("meter_type", e.target.value)}>
                  <option value="Prepaid">Prepaid</option>
                  <option value="Postpaid">Postpaid</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meter Rate (RM per kWh) *</Label>
                <input className={`${inputClass} w-full`} type="number" step="0.01" placeholder="e.g. 0.65" value={form.meter_rate || ""} onChange={e => updateField("meter_rate", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Main Door Passcode</Label>
                <input className={`${inputClass} w-full`} placeholder="Passcode" value={form.passcode} onChange={e => updateField("passcode", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">WiFi Name</Label>
                <input className={`${inputClass} w-full`} placeholder="WiFi SSID" value={form.wifi_name} onChange={e => updateField("wifi_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                <input className={`${inputClass} w-full`} placeholder="WiFi Password" value={form.wifi_password} onChange={e => updateField("wifi_password", e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Checkbox id="addInternalOnly" checked={form.internal_only} onCheckedChange={(checked) => updateField("internal_only", !!checked)} />
              <label htmlFor="addInternalOnly" className="text-sm font-medium cursor-pointer">🔒 Internal Only — Hidden from External Agent</label>
            </div>
          </section>

          {/* ── Rooms ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-semibold">Rooms</h2>
              <Button size="sm" onClick={addRoom}><Plus className="h-4 w-4 mr-1" /> Add Room</Button>
            </div>

            {roomRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No rooms added yet. Click "Add Room" to start.</p>
            ) : (
              <div className="space-y-2">
                {roomRecords.map(rc => rc._editing ? (
                  <RoomInlineForm key={rc._key} room={rc} onChange={(f, v) => updateRoom(rc._key, f, v)} onSave={() => saveRoom(rc._key)} onCancel={() => cancelRoomEdit(rc._key)} />
                ) : (
                  <RoomSummaryRow key={rc._key} room={rc} onEdit={() => updateRoom(rc._key, "_editing", true)} onDelete={() => setDeleteConfirm({ type: "room", key: rc._key })} />
                ))}
              </div>
            )}
          </section>

          {/* ── Carparks ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-semibold">Carparks</h2>
              <Button size="sm" onClick={addCarpark}><Plus className="h-4 w-4 mr-1" /> Add Carpark</Button>
            </div>

            {carparkRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No carparks added yet. Click "Add Carpark" to start.</p>
            ) : (
              <div className="space-y-2">
                {carparkRecords.map(cp => cp._editing ? (
                  <CarparkInlineForm key={cp._key} carpark={cp} onChange={(f, v) => updateCarpark(cp._key, f, v)} onSave={() => saveCarpark(cp._key)} onCancel={() => cancelCarparkEdit(cp._key)} />
                ) : (
                  <CarparkSummaryRow key={cp._key} carpark={cp} onEdit={() => updateCarpark(cp._key, "_editing", true)} onDelete={() => setDeleteConfirm({ type: "carpark", key: cp._key })} />
                ))}
              </div>
            )}
          </section>
        </div>
      </StandardModal>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Remove this item?"
        description="This item will be removed. This cannot be undone."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Room Inline Form ──
function RoomInlineForm({ room, onChange, onSave, onCancel }: {
  room: LocalRoom;
  onChange: (field: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const showAvailDate = room.status === "Available Soon";
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 border-primary/30">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{room.room}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button size="sm" onClick={onSave}><Check className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Room Photos */}
      <div>
        <label className="text-xs text-muted-foreground">Room Photos</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {(room.photos || []).map((path: string, pi: number) => (
            <div key={pi} className="relative group">
              <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Room ${pi + 1}`} className="h-16 w-16 object-cover rounded-lg" />
              <button onClick={() => onChange("photos", (room.photos || []).filter((_: any, idx: number) => idx !== pi))}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>
          ))}
          {(room.photos || []).length < 10 && (
            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
              <span className="text-lg text-muted-foreground">+</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                const remaining = 10 - (room.photos || []).length;
                const toUpload = files.slice(0, remaining);
                const newPaths: string[] = [];
                for (const file of toUpload) {
                  const ext = file.name.split('.').pop();
                  const path = `rooms/temp_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error } = await supabase.storage.from("room-photos").upload(path, file);
                  if (error) { alert(`Upload failed: ${error.message}`); continue; }
                  newPaths.push(path);
                }
                if (newPaths.length > 0) onChange("photos", [...(room.photos || []), ...newPaths]);
                e.target.value = "";
              }} />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Room Code</label>
          <input className={`${inputClass} w-full`} value={room.room} onChange={e => onChange("room", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Room Title *</label>
          <input className={`${inputClass} w-full`} placeholder="e.g. Balcony Queen Room" value={room.room_title || ""} onChange={e => onChange("room_title", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Room Type</label>
          <select className={`${inputClass} w-full`} value={room.room_category || "Normal Room"} onChange={e => {
            onChange("room_category", e.target.value);
            if (e.target.value === "Studio") onChange("bed_type", "None");
            else if (room.bed_type === "None") onChange("bed_type", "");
          }}>
            <option value="Normal Room">Room</option>
            <option value="Studio">Studio</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Bed Type {room.room_category !== "Studio" ? "*" : ""}</label>
          <select className={`${inputClass} w-full`} value={room.bed_type} onChange={e => {
            const bt = e.target.value;
            onChange("bed_type", bt);
            if (bt !== "None" && bedTypeMaxPax[bt]) onChange("max_pax", bedTypeMaxPax[bt]);
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
          <select className={`${inputClass} w-full`} value={room.wall_type || ""} onChange={e => onChange("wall_type", e.target.value)}>
            <option value="">—</option>
            <option value="Original">Original</option>
            <option value="Partition">Partition</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max Pax *</label>
          <input className={`${inputClass} w-full`} type="number" min={1} value={room.max_pax} onChange={e => onChange("max_pax", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Listed Rental (RM) *</label>
          <input className={`${inputClass} w-full`} type="number" value={room.rent || ""} onChange={e => onChange("rent", Number(e.target.value))} />
        </div>
        {/* Status is always "Available" for new rooms — no manual override */}
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Features</label>
        <div className="flex flex-wrap gap-2">
          {OPTIONAL_FEATURES.map(feat => {
            const selected = (room.optional_features || []).includes(feat);
            return (
              <button key={feat} type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-accent"}`}
                onClick={() => onChange("optional_features", selected ? (room.optional_features || []).filter(f => f !== feat) : [...(room.optional_features || []), feat])}
              >{feat}</button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Remark</label>
        <input className={`${inputClass} w-full`} placeholder="Internal notes…" value={room.internal_remark || ""} onChange={e => onChange("internal_remark", e.target.value)} />
      </div>
    </div>
  );
}

// ── Room Summary Row ──
function RoomSummaryRow({ room, onEdit, onDelete }: { room: LocalRoom; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="outline" className="font-mono">{room.room}</Badge>
        <span className="font-medium">{room.room_title || <span className="text-muted-foreground italic">No title</span>}</span>
        <span className="font-medium">RM{room.rent}</span>
        <StatusBadge status={room.status || "Available"} />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

// ── Carpark Inline Form ──
function CarparkInlineForm({ carpark, onChange, onSave, onCancel }: {
  carpark: LocalCarpark;
  onChange: (field: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border bg-accent/30 border-primary/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">🅿️ {carpark.room}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button size="sm" onClick={onSave}><Check className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Label</label>
          <input className={`${inputClass} w-full`} value={carpark.room} onChange={e => onChange("room", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Lot Number</label>
          <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={carpark.parking_lot} onChange={e => onChange("parking_lot", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Rental (RM)</label>
          <input className={`${inputClass} w-full`} type="number" value={carpark.rent || ""} onChange={e => onChange("rent", Number(e.target.value))} />
        </div>
        {/* Status is always "Available" for new carparks — no manual override */}
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Remark</label>
        <input className={`${inputClass} w-full`} placeholder="Notes…" value={carpark.internal_remark} onChange={e => onChange("internal_remark", e.target.value)} />
      </div>
    </div>
  );
}

// ── Carpark Summary Row ──
function CarparkSummaryRow({ carpark, onEdit, onDelete }: { carpark: LocalCarpark; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border bg-accent/30 px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">🅿️ {carpark.room}</span>
        {carpark.parking_lot && <span className="text-muted-foreground">{carpark.parking_lot}</span>}
        <span className="font-medium">RM{carpark.rent}</span>
        <StatusBadge status={carpark.status} />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

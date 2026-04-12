import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUnits, useUpdateUnit, useUpdateRoom, useCreateRoom, useDeleteRoom, Room, Unit } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { logActivity } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Save, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const OPTIONAL_FEATURES = ["Balcony", "Private Toilet", "Window", "Master Room", "Studio"];
const bedTypeMaxPax: Record<string, number> = { Single: 1, "Super Single": 1, Queen: 2, King: 2 };
const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface EditUnitProps {
  onClose?: () => void;
  unitIdProp?: string;
  focusRoomId?: string;
}

export default function EditUnit({ onClose, unitIdProp, focusRoomId }: EditUnitProps = {}) {
  const params = useParams<{ unitId: string }>();
  const unitId = unitIdProp || params.unitId;
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();
  const { data: condosList = [] } = useCondos();
  const updateUnit = useUpdateUnit();
  const updateRoom = useUpdateRoom();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();

  const unit = units.find(u => u.id === unitId);

  // Unit form
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<string | null>(null);
  const [collapsedRooms, setCollapsedRooms] = useState<Record<string, boolean>>(() => {
    if (focusRoomId) return { [focusRoomId]: false };
    return {};
  });

  // Scroll to focused room on mount
  useEffect(() => {
    if (focusRoomId) {
      setTimeout(() => {
        const el = document.getElementById(`room-card-${focusRoomId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [focusRoomId, unit]);

  // Initialize form from unit
  useEffect(() => {
    if (unit && !form) {
      setForm({
        building: unit.building,
        location: unit.location,
        unit: unit.unit,
        unit_type: unit.unit_type,
        unit_max_pax: unit.unit_max_pax,
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

  const rooms = useMemo(() => (unit?.rooms || []).filter(r => (r as any).room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark")), [unit]);
  const carparks = useMemo(() => (unit?.rooms || []).filter(r => (r as any).room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark")), [unit]);

  // Room edit state — inline editing per room
  const [roomEdits, setRoomEdits] = useState<Record<string, Record<string, any>>>({});

  const getRoomData = (room: Room) => {
    return roomEdits[room.id] ? { ...room, ...roomEdits[room.id] } : room;
  };

  const updateRoomField = (roomId: string, field: string, value: any) => {
    setRoomEdits(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], [field]: value },
    }));
  };

  if (isLoading || !form) {
    return <div className="flex items-center justify-center py-12"><span className="text-muted-foreground">Loading…</span></div>;
  }
  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <span className="text-muted-foreground">Unit not found.</span>
        <Button variant="outline" onClick={() => onClose ? onClose() : navigate("/admin", { state: { adminTab: "units" } })}>Back to Units</Button>
      </div>
    );
  }

  const updateField = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleSave = async () => {
    if (!form.building?.trim() || !form.unit?.trim()) {
      toast.error("Building and Unit Number are required.");
      return;
    }
    setSaving(true);
    try {
      // Save unit
      const { common_photos, ...rest } = form;
      await updateUnit.mutateAsync({ id: unit.id, ...rest, common_photos } as any);

      // Save edited rooms
      for (const [roomId, edits] of Object.entries(roomEdits)) {
        if (Object.keys(edits).length > 0) {
          const room = [...rooms, ...carparks].find(r => r.id === roomId);
          if (room) {
            await updateRoom.mutateAsync({ ...room, ...edits } as any);
          }
        }
      }

      logActivity("update_unit", "unit", unit.id, { building: form.building, unit: form.unit });
      toast.success("Unit updated successfully.");
      onClose ? onClose() : navigate("/admin", { state: { adminTab: "units" } });
    } catch (e: any) {
      toast.error(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const hasEdits = Object.keys(roomEdits).some(k => Object.keys(roomEdits[k]).length > 0);
    if (hasEdits) {
      setShowCancelConfirm(true);
    } else {
      onClose ? onClose() : navigate("/admin", { state: { adminTab: "units" } });
    }
  };

  // Auto-name next room/carpark
  const getNextRoomName = () => {
    const existingNames = rooms.map(r => r.room);
    const hasAlpha = existingNames.some(n => /Room [A-Z]$/.test(n));
    if (hasAlpha) {
      const usedLetters = existingNames.map(n => n.replace("Room ", "")).filter(l => l.length === 1 && /[A-Z]/.test(l));
      for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        if (!usedLetters.includes(letter)) return `Room ${letter}`;
      }
      return `Room ${rooms.length + 1}`;
    }
    const usedNums = existingNames.map(n => parseInt(n.replace("Room ", ""))).filter(n => !isNaN(n));
    let next = 1;
    while (usedNums.includes(next)) next++;
    return `Room ${next}`;
  };

  const getNextCarparkName = () => {
    const usedNums = carparks.map(cp => parseInt(cp.room.replace("Carpark ", ""))).filter(n => !isNaN(n));
    let next = 1;
    while (usedNums.includes(next)) next++;
    return `Carpark ${next}`;
  };

  const handleAddRoom = async () => {
    try {
      await createRoom.mutateAsync({
        room: getNextRoomName(),
        unit_id: unit.id,
        building: unit.building,
        unit: unit.unit,
        location: unit.location,
        rent: 0,
        room_type: "Normal Room",
        room_category: "Normal Room",
        unit_type: unit.unit_type,
        status: "Available",
        available_date: "",
        max_pax: 1,
        occupied_pax: 0,
        unit_max_pax: unit.unit_max_pax,
        unit_occupied_pax: 0,
        housemates: [],
        photos: [],
        access_info: "",
        move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
        bed_type: "",
        pax_staying: 0,
        tenant_gender: "",
        tenant_race: "",
        internal_only: (unit as any).internal_only || false,
        wall_type: "",
        optional_features: [],
        internal_remark: "",
      } as any);
      toast.success("Room added.");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddCarpark = async () => {
    try {
      await createRoom.mutateAsync({
        room: getNextCarparkName(),
        unit_id: unit.id,
        building: unit.building,
        unit: unit.unit,
        location: unit.location,
        rent: 150,
        room_type: "Car Park",
        unit_type: unit.unit_type,
        status: "Available",
        available_date: "",
        max_pax: 0,
        occupied_pax: 0,
        unit_max_pax: unit.unit_max_pax,
        unit_occupied_pax: 0,
        housemates: [],
        photos: [],
        access_info: "",
        move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
        bed_type: "",
        pax_staying: 0,
        tenant_gender: "",
        tenant_race: "",
        internal_only: false,
        parking_lot: "",
        assigned_to: "",
        internal_remark: "",
      } as any);
      toast.success("Carpark added.");
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleCollapse = (id: string) => setCollapsedRooms(prev => ({ ...prev, [id]: !prev[id] }));

  const content = (
    <>
      <div className="space-y-8">
        {/* ── Unit Information ── */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Unit Information</h2>

          {/* Common Area Photos */}
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
            <div>
              <Label className="text-xs text-muted-foreground">Building *</Label>
              <select className={`${inputClass} w-full`} value={form.building} onChange={e => {
                const condo = condosList.find(c => c.name === e.target.value);
                setForm((prev: any) => ({ ...prev, building: e.target.value, location: condo?.location?.name || prev.location }));
              }}>
                <option value="">— Select Building —</option>
                {condosList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Location</Label>
              <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={form.location} readOnly />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unit Number *</Label>
              <input className={`${inputClass} w-full`} value={form.unit} onChange={e => updateField("unit", e.target.value)} />
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
            <Checkbox id="internalOnly" checked={form.internal_only} onCheckedChange={(checked) => updateField("internal_only", !!checked)} />
            <label htmlFor="internalOnly" className="text-sm font-medium cursor-pointer">🔒 Internal Only — Hidden from External Agent</label>
          </div>
        </section>

        {/* ── Room Setup ── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-semibold">Room Setup</h2>
            <Button size="sm" onClick={handleAddRoom}>
              <Plus className="h-4 w-4 mr-1" /> Add Room
            </Button>
          </div>

          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms configured.</p>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => {
                const rc = getRoomData(room);
                const isCollapsed = collapsedRooms[room.id] !== false && collapsedRooms[room.id] !== undefined ? !collapsedRooms[room.id] : true;
                // Default to collapsed, toggle opens
                const collapsed = collapsedRooms[room.id] === undefined ? true : collapsedRooms[room.id];
                const upRoom = (field: string, value: any) => updateRoomField(room.id, field, value);
                const features = Array.isArray((rc as any).optional_features) ? (rc as any).optional_features : [];
                const showAvailDate = rc.status === "Available Soon";
                const showOccupant = rc.status === "Occupied";

                if (collapsed) {
                  const parts = [rc.room, (rc as any).bed_type || "—", `RM${rc.rent || 0}`, rc.status || "Available"];
                  return (
                    <div key={room.id} className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggleCollapse(room.id)}>
                      <span className="text-sm font-medium">{parts.join(" · ")}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remove" onClick={(e) => { e.stopPropagation(); setDeleteConfirmRoom(room.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={room.id} className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{rc.room}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View Photos" onClick={() => navigate(`/photos/${room.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remove" onClick={() => setDeleteConfirmRoom(room.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <button onClick={() => toggleCollapse(room.id)} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Collapse">
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Room Photos */}
                    <div>
                      <label className="text-xs text-muted-foreground">Room Photos</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {((rc as any).photos || []).map((path: string, pi: number) => (
                          <div key={pi} className="relative group">
                            <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Room ${pi + 1}`} className="h-16 w-16 object-cover rounded-lg" />
                            <button onClick={() => {
                              const currentPhotos = (rc as any).photos || [];
                              upRoom("photos", currentPhotos.filter((_: any, idx: number) => idx !== pi));
                            }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
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
                      {/* Bed Type */}
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

                      {/* Wall Type */}
                      <div>
                        <label className="text-xs text-muted-foreground">Wall Type</label>
                        <select className={`${inputClass} w-full`} value={(rc as any).wall_type || ""} onChange={e => upRoom("wall_type", e.target.value)}>
                          <option value="">—</option>
                          <option value="Original">Original</option>
                          <option value="Partition">Partition</option>
                        </select>
                      </div>

                      {/* Max Pax */}
                      <div>
                        <label className="text-xs text-muted-foreground">Maximum Pax *</label>
                        <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => upRoom("max_pax", Number(e.target.value))} />
                      </div>

                      {/* Monthly Rental */}
                      <div>
                        <label className="text-xs text-muted-foreground">Monthly Rental (RM) *</label>
                        <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => upRoom("rent", Number(e.target.value))} />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="text-xs text-muted-foreground">Room Status</label>
                        <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => upRoom("status", e.target.value)}>
                          <option value="Available">Available</option>
                          <option value="Available Soon">Available Soon</option>
                          <option value="Pending">Pending</option>
                          <option value="Occupied">Occupied</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>

                      {/* Available Date — only when Available Soon */}
                      {showAvailDate && (
                        <div>
                          <label className="text-xs text-muted-foreground">Available Date</label>
                          <input className={`${inputClass} w-full`} type="date" value={rc.available_date || ""} onChange={e => upRoom("available_date", e.target.value)} />
                        </div>
                      )}
                    </div>

                    {/* Optional Features */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Optional Features</label>
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

                    {/* Internal Remark */}
                    <div>
                      <label className="text-xs text-muted-foreground">Internal Remark</label>
                      <input className={`${inputClass} w-full`} placeholder="Internal notes…" value={(rc as any).internal_remark || ""} onChange={e => upRoom("internal_remark", e.target.value)} />
                    </div>

                    {/* Select Tenant — when Occupied */}
                    {showOccupant && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <label className="text-xs text-muted-foreground">Select Tenant</label>
                        <select className={`${inputClass} w-full mt-1`} disabled>
                          <option value="">— Select Tenant (coming soon) —</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Tenant list will be populated from approved bookings.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Carpark Setup ── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-semibold">Carpark Setup</h2>
            <Button size="sm" onClick={handleAddCarpark}>
              <Plus className="h-4 w-4 mr-1" /> Add Carpark
            </Button>
          </div>

          {carparks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No carparks configured.</p>
          ) : (
            <div className="space-y-2">
              {carparks.map(cp => {
                const rc = getRoomData(cp);
                const upCP = (field: string, value: any) => updateRoomField(cp.id, field, value);
                const cpOccupied = rc.status === "Occupied";
                return (
                  <div key={cp.id} className="rounded-lg border bg-accent/30 border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm">🅿️ {rc.room}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remove" onClick={() => setDeleteConfirmRoom(cp.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
                        <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => upCP("status", e.target.value)}>
                          <option value="Available">Available</option>
                          <option value="Occupied">Occupied</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Remark</label>
                        <input className={`${inputClass} w-full`} placeholder="Notes…" value={(rc as any).internal_remark || ""} onChange={e => upCP("internal_remark", e.target.value)} />
                      </div>
                    </div>
                    {cpOccupied && (
                      <div className="mt-3">
                        <label className="text-xs text-muted-foreground">Select Tenant</label>
                        <select className={`${inputClass} w-full mt-1`} disabled>
                          <option value="">— Select Tenant (coming soon) —</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Tenant list will be populated from approved bookings.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom buttons */}
        <div className="flex items-center justify-end gap-3 pb-8 border-t border-border pt-6">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirmRoom} onOpenChange={(open) => { if (!open) setDeleteConfirmRoom(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The room or carpark will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (deleteConfirmRoom) {
                try {
                  await deleteRoom.mutateAsync(deleteConfirmRoom);
                  toast.success("Removed.");
                } catch (e: any) { toast.error(e.message); }
              }
              setDeleteConfirmRoom(null);
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You may have unsaved changes. Are you sure you want to leave?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => onClose ? onClose() : navigate("/admin", { state: { adminTab: "units" } })}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (onClose) return content;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Unit</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {content}
      </div>
    </div>
  );
}

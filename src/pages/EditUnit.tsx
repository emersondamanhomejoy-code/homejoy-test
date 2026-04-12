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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Save } from "lucide-react";
import { toast } from "sonner";

const OPTIONAL_FEATURES = ["Balcony", "Private Toilet", "Window", "Master Room", "Studio"];
const bedTypeMaxPax: Record<string, number> = { Single: 1, "Super Single": 1, Queen: 2, King: 2 };
const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function EditUnit() {
  const { unitId } = useParams<{ unitId: string }>();
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
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingCarpark, setEditingCarpark] = useState<Room | null>(null);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<string | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const [addingCarpark, setAddingCarpark] = useState(false);

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

  if (isLoading || !form) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground">Loading…</span></div>;
  }
  if (!unit) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="text-muted-foreground">Unit not found.</span>
        <Button variant="outline" onClick={() => navigate("/admin", { state: { adminTab: "units" } })}>Back to Units</Button>
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
      const { common_photos, ...rest } = form;
      await updateUnit.mutateAsync({
        id: unit.id,
        ...rest,
        common_photos,
      } as any);
      logActivity("update_unit", "unit", unit.id, { building: form.building, unit: form.unit });
      toast.success("Unit updated successfully.");
      navigate("/admin", { state: { adminTab: "units" } });
    } catch (e: any) {
      toast.error(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  // Determine next room name
  const getNextRoomName = () => {
    const existingNames = rooms.map(r => r.room);
    // Detect naming convention
    const hasAlpha = existingNames.some(n => /Room [A-Z]$/.test(n));
    if (hasAlpha) {
      const usedLetters = existingNames.map(n => n.replace("Room ", "")).filter(l => l.length === 1 && /[A-Z]/.test(l));
      for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        if (!usedLetters.includes(letter)) return `Room ${letter}`;
      }
      return `Room ${rooms.length + 1}`;
    }
    // Digit naming
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
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

        {/* ── Rooms Section ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-semibold">Rooms</h2>
            <Button size="sm" onClick={() => setAddingRoom(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Room
            </Button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Bed Type</TableHead>
                    <TableHead>Wall Type</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-center">Max Pax</TableHead>
                    <TableHead className="text-right">Rental (RM)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Available Date</TableHead>
                    <TableHead className="text-center">Pax Staying</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map(room => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.room.replace(/^Room\s+/i, "")}</TableCell>
                      <TableCell>{room.bed_type || "—"}</TableCell>
                      <TableCell>{(room as any).wall_type || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const feats = [...((room as any).optional_features || [])];
                            if (((room as any).room_category === "Studio" || room.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
                            return feats.length > 0 ? feats.map((f: string) => (
                              <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                            )) : <span className="text-muted-foreground text-xs">—</span>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{room.max_pax}</TableCell>
                      <TableCell className="text-right">{room.rent}</TableCell>
                      <TableCell><StatusBadge status={room.status} /></TableCell>
                      <TableCell>{(room.status === "Available Soon" || room.status === "Pending") ? (room.available_date || "—") : ""}</TableCell>
                      <TableCell className="text-center">{room.pax_staying || 0}</TableCell>
                      <TableCell>{(room as any).tenant_nationality || "—"}</TableCell>
                      <TableCell>{room.tenant_gender || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => navigate(`/photos/${room.id}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditingRoom({ ...room })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Archive / Remove" onClick={() => setDeleteConfirmRoom(room.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* ── Carparks Section ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-semibold">Carparks</h2>
            <Button size="sm" onClick={() => setAddingCarpark(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Carpark
            </Button>
          </div>
          {carparks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No carparks configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carpark Name</TableHead>
                    <TableHead>Lot Number</TableHead>
                    <TableHead className="text-right">Rental (RM)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carparks.map(cp => (
                    <TableRow key={cp.id}>
                      <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                      <TableCell>{(cp as any).parking_lot || "—"}</TableCell>
                      <TableCell className="text-right">{cp.rent}</TableCell>
                      <TableCell><StatusBadge status={cp.status} /></TableCell>
                      <TableCell>{(cp as any).assigned_to || "—"}</TableCell>
                      <TableCell>{(cp as any).internal_remark || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditingCarpark({ ...cp })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remove" onClick={() => setDeleteConfirmRoom(cp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Bottom actions */}
        <div className="flex items-center justify-end gap-3 pb-8 border-t border-border pt-6">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </div>
      </div>

      {/* ── Edit Room Dialog ── */}
      <RoomEditDialog room={editingRoom} onClose={() => setEditingRoom(null)} onSave={async (data) => {
        try {
          await updateRoom.mutateAsync(data as any);
          toast.success("Room updated.");
          setEditingRoom(null);
        } catch (e: any) { toast.error(e.message); }
      }} />

      {/* ── Edit Carpark Dialog ── */}
      <CarparkEditDialog carpark={editingCarpark} onClose={() => setEditingCarpark(null)} onSave={async (data) => {
        try {
          await updateRoom.mutateAsync(data as any);
          toast.success("Carpark updated.");
          setEditingCarpark(null);
        } catch (e: any) { toast.error(e.message); }
      }} />

      {/* ── Add Room Dialog ── */}
      <RoomEditDialog room={addingRoom ? { id: "__new__", room: getNextRoomName(), unit_id: unit.id, building: unit.building, unit: unit.unit, location: unit.location, rent: 0, room_type: "Normal Room", room_category: "Normal Room", unit_type: unit.unit_type, status: "Available", available_date: "", max_pax: 1, occupied_pax: 0, unit_max_pax: unit.unit_max_pax, unit_occupied_pax: 0, housemates: [], photos: [], access_info: "", move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 }, bed_type: "", pax_staying: 0, tenant_gender: "", tenant_race: "", internal_only: (unit as any).internal_only || false, created_at: "", updated_at: "", wall_type: "", optional_features: [], internal_remark: "" } as any : null}
        onClose={() => setAddingRoom(false)}
        onSave={async (data) => {
          try {
            const { id, created_at, updated_at, ...fields } = data as any;
            await createRoom.mutateAsync(fields);
            toast.success("Room added.");
            setAddingRoom(false);
          } catch (e: any) { toast.error(e.message); }
        }}
        isNew
      />

      {/* ── Add Carpark Dialog ── */}
      <CarparkEditDialog carpark={addingCarpark ? { id: "__new__", room: getNextCarparkName(), unit_id: unit.id, building: unit.building, unit: unit.unit, location: unit.location, rent: 150, room_type: "Car Park", unit_type: unit.unit_type, status: "Available", available_date: "", max_pax: 0, occupied_pax: 0, unit_max_pax: unit.unit_max_pax, unit_occupied_pax: 0, housemates: [], photos: [], access_info: "", move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 }, bed_type: "", pax_staying: 0, tenant_gender: "", tenant_race: "", internal_only: false, created_at: "", updated_at: "", parking_lot: "", assigned_to: "", internal_remark: "" } as any : null}
        onClose={() => setAddingCarpark(false)}
        onSave={async (data) => {
          try {
            const { id, created_at, updated_at, ...fields } = data as any;
            await createRoom.mutateAsync(fields);
            toast.success("Carpark added.");
            setAddingCarpark(false);
          } catch (e: any) { toast.error(e.message); }
        }}
        isNew
      />

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
            <AlertDialogAction onClick={() => navigate("/admin", { state: { adminTab: "units" } })}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Room Edit Dialog ─── */
function RoomEditDialog({ room, onClose, onSave, isNew }: { room: Room | null; onClose: () => void; onSave: (data: any) => void; isNew?: boolean }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (room) setData({ ...room }); else setData(null); }, [room]);
  if (!data) return null;
  const up = (f: string, v: any) => setData((prev: any) => ({ ...prev, [f]: v }));
  const features = Array.isArray(data.optional_features) ? data.optional_features : [];

  return (
    <Dialog open={!!room} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Room" : `Edit ${data.room}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Room Name</label>
              <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={data.room} readOnly />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bed Type {!isStudio && "*"}</label>
              <select className={`${inputClass} w-full`} value={data.bed_type || ""} onChange={e => {
                const bt = e.target.value;
                up("bed_type", bt);
                if (bedTypeMaxPax[bt]) up("max_pax", bedTypeMaxPax[bt]);
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
              <select className={`${inputClass} w-full`} value={data.wall_type || ""} onChange={e => up("wall_type", e.target.value)}>
                <option value="">—</option>
                <option value="Original">Original</option>
                <option value="Partition">Partition</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Maximum Pax *</label>
              <input className={`${inputClass} w-full`} type="number" min={1} value={data.max_pax} onChange={e => up("max_pax", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Monthly Rental (RM) *</label>
              <input className={`${inputClass} w-full`} type="number" value={data.rent || ""} onChange={e => up("rent", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Room Status</label>
              <select className={`${inputClass} w-full`} value={data.status || "Available"} onChange={e => up("status", e.target.value)}>
                <option value="Available">Available</option>
                <option value="Available Soon">Available Soon</option>
                <option value="Pending">Pending</option>
                <option value="Occupied">Occupied</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            {data.status === "Available Soon" && (
              <div>
                <label className="text-xs text-muted-foreground">Available Date</label>
                <input className={`${inputClass} w-full`} type="date" value={data.available_date || ""} onChange={e => up("available_date", e.target.value)} />
              </div>
            )}
          </div>
          {/* Optional Features */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Optional Features</label>
            <div className="flex flex-wrap gap-2">
              {OPTIONAL_FEATURES.map(feat => {
                const features = Array.isArray(data.optional_features) ? data.optional_features : [];
                const selected = features.includes(feat);
                return (
                  <button key={feat} type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-accent"}`}
                    onClick={() => up("optional_features", selected ? features.filter((f: string) => f !== feat) : [...features, feat])}
                  >{feat}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Internal Remark</label>
            <input className={`${inputClass} w-full`} value={data.internal_remark || ""} onChange={e => up("internal_remark", e.target.value)} />
          </div>
          {data.status === "Occupied" && (
            <div className="bg-muted/50 rounded-lg p-3">
              <label className="text-xs text-muted-foreground">Select Tenant</label>
              <select className={`${inputClass} w-full mt-1`} disabled>
                <option value="">— Select Tenant (coming soon) —</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Tenant list will be populated from approved bookings.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(data)}><Save className="h-4 w-4 mr-1" /> {isNew ? "Add Room" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Carpark Edit Dialog ─── */
function CarparkEditDialog({ carpark, onClose, onSave, isNew }: { carpark: Room | null; onClose: () => void; onSave: (data: any) => void; isNew?: boolean }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (carpark) setData({ ...carpark }); else setData(null); }, [carpark]);
  if (!data) return null;
  const up = (f: string, v: any) => setData((prev: any) => ({ ...prev, [f]: v }));

  return (
    <Dialog open={!!carpark} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Carpark" : `Edit ${data.room}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Carpark Name</label>
              <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={data.room} readOnly />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Lot Number</label>
              <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={data.parking_lot || ""} onChange={e => up("parking_lot", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rental (RM)</label>
              <input className={`${inputClass} w-full`} type="number" value={data.rent || ""} onChange={e => up("rent", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select className={`${inputClass} w-full`} value={data.status || "Available"} onChange={e => up("status", e.target.value)}>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
          {data.status === "Occupied" && (
            <div>
              <label className="text-xs text-muted-foreground">Select Tenant</label>
              <select className={`${inputClass} w-full mt-1`} disabled>
                <option value="">— Select Tenant (coming soon) —</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Remark</label>
            <input className={`${inputClass} w-full`} value={data.internal_remark || ""} onChange={e => up("internal_remark", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(data)}><Save className="h-4 w-4 mr-1" /> {isNew ? "Add Carpark" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

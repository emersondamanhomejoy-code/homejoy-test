import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCondos } from "@/hooks/useCondos";
import { useCreateUnit, RoomConfig } from "@/hooks/useRooms";
import { logActivity } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Trash2, Save } from "lucide-react";

const bedTypeMaxPax: Record<string, number> = {
  Single: 1, "Super Single": 1, Queen: 2, King: 2,
};

const getDefaultRoomName = (index: number, naming: "alpha" | "digit") =>
  naming === "alpha" ? `Room ${String.fromCharCode(65 + index)}` : `Room ${index + 1}`;

const getDefaultCarParkName = (index: number) => index === 0 ? "Car Park" : `Car Park ${index + 1}`;

const hasMeaningfulData = (rc: RoomConfig, index: number, naming: "alpha" | "digit", isCarPark: boolean) => {
  if (isCarPark) {
    return Boolean(rc.bed_type?.trim()) || Number(rc.rent) > 150;
  }
  return Boolean(rc.bed_type?.trim()) || Number(rc.rent) > 0 || Number(rc.max_pax) !== 1 ||
    (rc.status && rc.status !== "Available") || Boolean(rc.tenant_name?.trim());
};

const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function AddUnit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: condosList = [] } = useCondos();
  const createUnit = useCreateUnit();

  // Unit form state
  const [form, setForm] = useState({
    building: "", location: "", unit: "", unit_type: "Mix Unit",
    unit_max_pax: 6, deposit_multiplier: 1.5, admin_fee: 330,
    meter_type: "Postpaid", meter_rate: 0.65, passcode: "",
    wifi_name: "", wifi_password: "", internal_only: false,
    common_photos: [] as string[],
  });

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  // Room configs
  const [roomNaming, setRoomNaming] = useState<"alpha" | "digit">("alpha");
  const [roomCountInput, setRoomCountInput] = useState("5");
  const [carParkCountInput, setCarParkCountInput] = useState("1");
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(() => {
    const rooms: RoomConfig[] = Array.from({ length: 5 }, (_, i) => ({
      room: getDefaultRoomName(i, "alpha"), bed_type: "", max_pax: 1, rent: 0, status: "Available",
    }));
    const cps: RoomConfig[] = [{ room: getDefaultCarParkName(0), bed_type: "", max_pax: 0, rent: 150, room_type: "Car Park" }];
    return [...rooms, ...cps];
  });

  // Dialogs
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReduceConfirm, setShowReduceConfirm] = useState<{ type: "room" | "carpark"; newCount: number } | null>(null);
  const [collapsedRooms, setCollapsedRooms] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const rebuildConfigs = (roomCount: number, carParkCount: number, naming: "alpha" | "digit") => {
    const regularRooms = roomConfigs.filter(r => r.room_type !== "Car Park");
    const carParks = roomConfigs.filter(r => r.room_type === "Car Park");

    let nextRooms = regularRooms.slice(0, roomCount).map((room, i) => ({ ...room, room: getDefaultRoomName(i, naming) }));
    while (nextRooms.length < roomCount) {
      nextRooms.push({ room: getDefaultRoomName(nextRooms.length, naming), bed_type: "", max_pax: 1, rent: 0, status: "Available" });
    }

    let nextCPs = carParks.slice(0, carParkCount).map((cp, i) => ({ ...cp, room: getDefaultCarParkName(i) }));
    while (nextCPs.length < carParkCount) {
      nextCPs.push({ room: getDefaultCarParkName(nextCPs.length), bed_type: "", max_pax: 0, rent: 150, room_type: "Car Park" });
    }

    setRoomConfigs([...nextRooms, ...nextCPs]);
  };

  const handleRoomCountChange = (val: string) => {
    const n = Math.max(1, Math.min(20, Math.floor(Number(val) || 1)));
    const currentRooms = roomConfigs.filter(r => r.room_type !== "Car Park");
    if (n < currentRooms.length) {
      // Check if any removed rooms have data
      const removedRooms = currentRooms.slice(n);
      const hasData = removedRooms.some((rc, i) => hasMeaningfulData(rc, n + i, roomNaming, false));
      if (hasData) {
        setShowReduceConfirm({ type: "room", newCount: n });
        return;
      }
    }
    setRoomCountInput(String(n));
    rebuildConfigs(n, Number(carParkCountInput) || 0, roomNaming);
  };

  const handleCarParkCountChange = (val: string) => {
    const n = Math.max(0, Math.min(10, Math.floor(Number(val) || 0)));
    const currentCPs = roomConfigs.filter(r => r.room_type === "Car Park");
    if (n < currentCPs.length) {
      const removedCPs = currentCPs.slice(n);
      const hasData = removedCPs.some((rc, i) => hasMeaningfulData(rc, n + i, roomNaming, true));
      if (hasData) {
        setShowReduceConfirm({ type: "carpark", newCount: n });
        return;
      }
    }
    setCarParkCountInput(String(n));
    rebuildConfigs(Number(roomCountInput) || 1, n, roomNaming);
  };

  const confirmReduce = () => {
    if (!showReduceConfirm) return;
    const { type, newCount } = showReduceConfirm;
    if (type === "room") {
      setRoomCountInput(String(newCount));
      rebuildConfigs(newCount, Number(carParkCountInput) || 0, roomNaming);
    } else {
      setCarParkCountInput(String(newCount));
      rebuildConfigs(Number(roomCountInput) || 1, newCount, roomNaming);
    }
    setShowReduceConfirm(null);
  };

  const handleNamingChange = (n: "alpha" | "digit") => {
    setRoomNaming(n);
    rebuildConfigs(Number(roomCountInput) || 1, Number(carParkCountInput) || 0, n);
  };

  const handleCancel = () => {
    const hasAnyData = form.building || form.unit || roomConfigs.some((rc, i) =>
      hasMeaningfulData(rc, i, roomNaming, rc.room_type === "Car Park")
    );
    if (hasAnyData) {
      setShowCancelConfirm(true);
    } else {
      navigate("/admin", { state: { adminTab: "units" } });
    }
  };

  const saveUnit = async () => {
    const missingFields: string[] = [];
    if (!form.building.trim()) missingFields.push("Building");
    if (!form.location.trim()) missingFields.push("Location");
    if (!form.unit.trim()) missingFields.push("Unit Number");
    if (!Number.isFinite(form.unit_max_pax) || form.unit_max_pax < 1) missingFields.push("Maximum Occupants");
    if (!Number.isFinite(form.deposit_multiplier) || form.deposit_multiplier <= 0) missingFields.push("Rental Deposit Multiplier");
    if (!Number.isFinite(form.admin_fee) || form.admin_fee < 0) missingFields.push("Admin Fee");
    if (!Number.isFinite(form.meter_rate) || form.meter_rate < 0) missingFields.push("Meter Rate");

    const regularRooms = roomConfigs.filter(r => r.room_type !== "Car Park");
    const carParks = roomConfigs.filter(r => r.room_type === "Car Park");

    regularRooms.forEach((room, index) => {
      const label = room.room || getDefaultRoomName(index, roomNaming);
      if (!room.bed_type.trim()) missingFields.push(`${label} Bed Type`);
      if (!Number.isFinite(Number(room.max_pax)) || Number(room.max_pax) < 1) missingFields.push(`${label} Max Pax`);
      if (!Number.isFinite(Number(room.rent)) || Number(room.rent) <= 0) missingFields.push(`${label} Rent`);
    });

    carParks.forEach((room, index) => {
      const label = room.room || `Car Park ${index + 1}`;
      if (!room.bed_type?.trim()) missingFields.push(`${label} Parking Lot`);
    });

    if (missingFields.length > 0) {
      alert(`Please complete the required fields:\n• ${missingFields.join("\n• ")}`);
      return;
    }

    setSaving(true);
    try {
      const { common_photos, wifi_name, wifi_password, ...unitData } = form;
      await createUnit.mutateAsync({
        unit: {
          ...unitData,
          common_photos,
          wifi_name,
          wifi_password,
          access_info: "",
        } as any,
        roomConfigs,
      });
      logActivity("create_unit", "unit", "", { building: form.building, unit: form.unit });
      navigate("/admin", { state: { adminTab: "units" } });
    } catch (e: any) {
      alert(e.message || "Failed to save unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Add Unit</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={saveUnit} disabled={saving}>
              {saving ? "Saving..." : "Save Unit & Rooms"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
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
            <Checkbox id="internalOnly" checked={form.internal_only} onCheckedChange={(checked) => updateField("internal_only", !!checked)} />
            <label htmlFor="internalOnly" className="text-sm font-medium cursor-pointer">🔒 Internal Only — Hidden from External Agent</label>
          </div>
        </section>

        {/* ── Rooms & Car Parks ── */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Rooms & Car Parks</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Number of Rooms *</Label>
              <input className={`${inputClass} w-full`} type="number" min={1} max={20} value={roomCountInput}
                onChange={e => setRoomCountInput(e.target.value)}
                onBlur={() => handleRoomCountChange(roomCountInput)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleRoomCountChange(roomCountInput); } }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Number of Car Parks</Label>
              <input className={`${inputClass} w-full`} type="number" min={0} max={10} value={carParkCountInput}
                onChange={e => setCarParkCountInput(e.target.value)}
                onBlur={() => handleCarParkCountChange(carParkCountInput)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCarParkCountChange(carParkCountInput); } }}
              />
            </div>
          </div>

          {/* Naming convention */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-2">Room Naming Convention</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="roomNaming" value="alpha" checked={roomNaming === "alpha"} onChange={() => handleNamingChange("alpha")} className="w-4 h-4 accent-primary" />
                <span className="text-sm">Alphabet (Room A, B, C…)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="roomNaming" value="digit" checked={roomNaming === "digit"} onChange={() => handleNamingChange("digit")} className="w-4 h-4 accent-primary" />
                <span className="text-sm">Digit (Room 1, 2, 3…)</span>
              </label>
            </div>
          </div>

          {/* Room cards */}
          <div className="space-y-3">
            {roomConfigs.map((rc, i) => {
              const isCP = rc.room_type === "Car Park";
              const isCollapsed = !!collapsedRooms[i];
              const updateRC = (field: string, value: any) => {
                const c = [...roomConfigs];
                c[i] = { ...c[i], [field]: value };
                setRoomConfigs(c);
              };
              const toggleCollapse = () => setCollapsedRooms(prev => ({ ...prev, [i]: !prev[i] }));

              // Collapsed summary
              if (isCollapsed) {
                const summary = isCP
                  ? `🅿️ ${rc.room} · ${rc.bed_type || "—"} · RM${rc.rent || 0} · ${rc.status || "Available"}`
                  : `${rc.room} · ${rc.bed_type || "—"} · RM${rc.rent || 0} · ${rc.status || "Available"}`;
                return (
                  <div key={i} className={`rounded-lg border px-4 py-3 flex items-center justify-between ${isCP ? "bg-sky-500/5 border-sky-500/20" : "bg-card"}`}>
                    <span className="text-sm font-medium">{summary}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={toggleCollapse} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Edit">
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Expanded card
              return (
                <div key={i} className={`rounded-lg border p-4 space-y-3 ${isCP ? "bg-sky-500/5 border-sky-500/20" : "bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{isCP ? `🅿️ ${rc.room}` : rc.room}</span>
                    <button onClick={toggleCollapse} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Save & Collapse">
                      <Save className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  {isCP ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Parking Lot *</label>
                        <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={rc.bed_type || ""} onChange={e => updateRC("bed_type", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Rental (RM)</label>
                        <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => updateRC("rent", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Status</label>
                        <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => updateRC("status", e.target.value)}>
                          <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
                        📷 Room photos can be uploaded after the unit is created.
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Bed Type *</label>
                          <select className={`${inputClass} w-full`} value={rc.bed_type} onChange={e => {
                            const bt = e.target.value;
                            const c = [...roomConfigs];
                            c[i] = { ...c[i], bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 };
                            setRoomConfigs(c);
                          }}>
                            <option value="">—</option><option value="Single">Single</option><option value="Super Single">Super Single</option><option value="Queen">Queen</option><option value="King">King</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rental (RM) *</label>
                          <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => updateRC("rent", Number(e.target.value))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Max Pax *</label>
                          <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => updateRC("max_pax", Number(e.target.value))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Wall Type</label>
                          <select className={`${inputClass} w-full`} value={(rc as any).wall_type || ""} onChange={e => updateRC("wall_type", e.target.value)}>
                            <option value="">—</option><option value="Partition">Partition</option><option value="Original">Original</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Special Type</label>
                          <select className={`${inputClass} w-full`} value={(rc as any).special_type || ""} onChange={e => updateRC("special_type", e.target.value)}>
                            <option value="">— None —</option><option value="Balcony">Balcony</option><option value="Master">Master</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Status</label>
                          <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => updateRC("status", e.target.value)}>
                            <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Available Date</label>
                          <input className={`${inputClass} w-full`} type="date" value={(rc as any).available_date && (rc as any).available_date !== "Available Now" ? (rc as any).available_date : ""} onChange={e => updateRC("available_date", e.target.value || "Available Now")} />
                          <span className="text-xs text-muted-foreground">Leave empty for "Available Now"</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom buttons */}
        <div className="flex items-center justify-end gap-3 pb-8 border-t border-border pt-6">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={saveUnit} disabled={saving}>
            {saving ? "Saving..." : "Save Unit & Rooms"}
          </Button>
        </div>
      </div>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Are you sure you want to leave?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/admin", { state: { adminTab: "units" } })}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reduce Confirmation */}
      <AlertDialog open={!!showReduceConfirm} onOpenChange={(open) => { if (!open) setShowReduceConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {showReduceConfirm?.type === "room" ? "rooms" : "car parks"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Some of the {showReduceConfirm?.type === "room" ? "rooms" : "car parks"} you're removing already have data filled in. This data will be lost. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReduce}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

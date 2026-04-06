import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useUpdateRoom, useCreateRoom, useDeleteRoom, Unit, Room, RoomConfig } from "@/hooks/useRooms";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { useClaims, useUpdateClaimStatus, Claim } from "@/hooks/useClaims";

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

interface CommissionTier {
  min: number;
  max: number | null;
  amount?: number;
  percentage?: number;
}

interface CommissionConfig {
  percentage?: number;
  tiers?: CommissionTier[];
}

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
  commission_type: string;
  commission_config: CommissionConfig | null;
}

const defaultConfigs: Record<string, CommissionConfig> = {
  external: { percentage: 100 },
  internal_basic: { tiers: [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }] },
  internal_full: { tiers: [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }] },
};

const bedTypeMaxPax: Record<string, number> = {
  MASTER: 2, QUEEN: 2, "QUEEN BALCONY": 2, MEDIUM: 2, SINGLE: 1, "SUPER SINGLE": 1,
};

const defaultRoomConfigs: RoomConfig[] = [
  { room: "Room A", bed_type: "", max_pax: 1, rent: 0 },
  { room: "Room B", bed_type: "", max_pax: 1, rent: 0 },
  { room: "Room C", bed_type: "", max_pax: 1, rent: 0 },
  { room: "Room D", bed_type: "", max_pax: 1, rent: 0 },
  { room: "Room E", bed_type: "", max_pax: 1, rent: 0 },
];

const emptyUnit = {
  building: "", unit: "", location: "", unit_type: "Mix Unit", unit_max_pax: 6,
  passcode: "", access_card: "", parking_lot: "",
  access_card_source: "Provided by Us", access_card_deposit: 0,
  access_info: "", internal_only: false,
  deposit: "", meter_type: "Postpaid", meter_rate: 0,
  deposit_multiplier: 1.5, admin_fee: 330,
};

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"dashboard" | "users" | "units" | "claims">("dashboard");

  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionDraft, setCommissionDraft] = useState<{ type: string; config: CommissionConfig }>({ type: "internal_basic", config: defaultConfigs.internal_basic });

  // Units state
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();
  const [editingUnit, setEditingUnit] = useState<typeof emptyUnit & { id?: string } | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(defaultRoomConfigs);
  const [unitFilters, setUnitFilters] = useState({ location: "All", building: "All", price: "All", unitType: "All" });

  // Bookings state
  const { data: allBookings = [] } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Claims state
  const { data: allClaims = [] } = useClaims();
  const updateClaimStatus = useUpdateClaimStatus();
  const [claimRejectReason, setClaimRejectReason] = useState("");

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) navigate("/");
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (user && role === "admin") fetchUsers();
  }, [user, role]);

  const fetchUsers = async () => {
    setFetching(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      setUsers(res.data as UserWithRoles[]);
    } catch (e: any) {
      setError(e.message || "Failed to fetch users");
    } finally {
      setFetching(false);
    }
  };

  const toggleRole = async (userId: string, targetRole: "admin" | "agent", hasRole: boolean) => {
    setUpdating(userId + targetRole);
    try {
      if (hasRole) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", targetRole);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: targetRole });
        if (error) throw error;
      }
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const openCreateRoom2 = () => {
    setEditingUnit({ ...emptyUnit });
    setRoomConfigs([...defaultRoomConfigs]);
  };

  const saveUnit = async () => {
    if (!editingUnit) return;
    try {
      if (editingUnit.id) {
        await updateUnit.mutateAsync({ id: editingUnit.id, ...editingUnit });
      } else {
        await createUnit.mutateAsync({ unit: editingUnit, roomConfigs });
      }
      setEditingUnit(null);
    } catch (e: any) {
      alert(e.message || "Failed to save unit");
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm("Delete this unit and all its rooms?")) return;
    try { await deleteUnit.mutateAsync(id); } catch (e: any) { alert(e.message); }
  };

  const saveRoom = async () => {
    if (!editingRoom) return;
    try {
      await updateRoom.mutateAsync(editingRoom);
      setEditingRoom(null);
    } catch (e: any) {
      alert(e.message || "Failed to save room");
    }
  };

  const toggleRoomStatus = async (room: Room) => {
    const newStatus = room.status === "Available" ? "Tenanted" : "Available";
    try {
      await updateRoom.mutateAsync({ id: room.id, status: newStatus });
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  // ─── ROOM EDIT FORM ───
  if (editingRoom) {
    const r = editingRoom;
    const isCarPark = r.room_type === "Car Park";
    const updateField = (field: string, value: any) => setEditingRoom({ ...r, [field]: value });
    const updateCost = (field: string, value: number) => setEditingRoom({ ...r, move_in_cost: { ...r.move_in_cost, [field]: value } });

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setEditingRoom(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
          <div className="text-2xl font-extrabold">Edit {isCarPark ? `🅿️ ${r.room}` : r.room}</div>
          <div className="text-muted-foreground text-sm">{r.building} {r.unit}</div>
          <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
            {isCarPark ? (() => {
              const sameBuildingTenants = units
                .filter(u => u.building === r.building)
                .flatMap(u => (u.rooms || []).filter(rm => rm.room_type !== "Car Park" && rm.status === "Tenanted" && rm.tenant_gender))
                .map(rm => `${rm.unit} ${rm.room} — ${rm.tenant_gender}`);
              return (
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Parking Lot</label><input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={r.bed_type || ""} onChange={e => updateField("bed_type", e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Rent (RM)</label><input className={`${inputClass} w-full`} type="number" value={r.rent} onChange={e => updateField("rent", Number(e.target.value))} /></div>
                <div><label className="text-xs text-muted-foreground">Status</label>
                  <select className={`${inputClass} w-full`} value={r.status} onChange={e => updateField("status", e.target.value)}>
                    <option>Available</option><option>Tenanted</option><option>Unavailable</option>
                  </select>
                </div>
                <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Rented to (Tenant from same building)</label>
                  <select className={`${inputClass} w-full`} value={r.tenant_gender || ""} onChange={e => updateField("tenant_gender", e.target.value)}>
                    <option value="">— None —</option>
                    {sameBuildingTenants.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={`${inputClass} w-full mt-2`} placeholder="Or type manually (e.g. name / plate)" value={r.tenant_gender || ""} onChange={e => updateField("tenant_gender", e.target.value)} />
                </div>
              </div>
              );
            })() : (
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="text-xs text-muted-foreground">Bed Type</label>
                <select className={`${inputClass} w-full`} value={r.bed_type || ""} onChange={e => { const bt = e.target.value; setEditingRoom({ ...r, bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 }); }}>
                  <option value="">—</option><option>MASTER</option><option>QUEEN</option><option>QUEEN BALCONY</option><option>MEDIUM</option><option>SINGLE</option><option>SUPER SINGLE</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Rent (RM)</label><input className={`${inputClass} w-full`} type="number" value={r.rent} onChange={e => updateField("rent", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Status</label>
                <select className={`${inputClass} w-full`} value={r.status} onChange={e => updateField("status", e.target.value)}>
                  <option>Available</option><option>Tenanted</option><option>Unavailable</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Pax Staying</label><input className={`${inputClass} w-full`} type="number" value={r.pax_staying ?? 0} onChange={e => updateField("pax_staying", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Max Pax</label><input className={`${inputClass} w-full`} type="number" value={r.max_pax} onChange={e => updateField("max_pax", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Available Date</label><input className={`${inputClass} w-full`} value={r.available_date} onChange={e => updateField("available_date", e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Tenant Gender</label><input className={`${inputClass} w-full`} placeholder="e.g. Chinese girl" value={r.tenant_gender || ""} onChange={e => updateField("tenant_gender", e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Tenant Race</label><input className={`${inputClass} w-full`} placeholder="e.g. Indian, Malay" value={r.tenant_race || ""} onChange={e => updateField("tenant_race", e.target.value)} /></div>
            </div>
            )}
            {!isCarPark && (
            <>
            <div className="text-lg font-semibold pt-2">Move-in Cost (RM)</div>
            <div className="grid md:grid-cols-4 gap-4">
              <div><label className="text-xs text-muted-foreground">Advance</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.advance ?? 0} onChange={e => updateCost("advance", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Deposit</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.deposit ?? 0} onChange={e => updateCost("deposit", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Access Card</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.accessCard ?? 0} onChange={e => updateCost("accessCard", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Move-in Fee</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.moveInFee ?? 0} onChange={e => updateCost("moveInFee", Number(e.target.value))} /></div>
            </div>
            <div className="text-sm text-muted-foreground">Total: RM{(r.move_in_cost?.advance || 0) + (r.move_in_cost?.deposit || 0) + (r.move_in_cost?.accessCard || 0) + (r.move_in_cost?.moveInFee || 0)}</div>
            </>
            )}

            {/* Room Photos */}
            {!isCarPark && (
            <>
            <div className="text-lg font-semibold pt-2">Room Photos</div>
            <div className="grid grid-cols-3 gap-3">
              {(r.photos as string[] || []).map((url: string, i: number) => (
                <div key={i} className="relative group">
                  <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${url}`} alt={`Photo ${i + 1}`} className="h-32 w-full object-cover rounded-lg" />
                  <button onClick={async () => {
                    const newPhotos = (r.photos as string[]).filter((_, idx) => idx !== i);
                    updateField("photos", newPhotos);
                    try { await updateRoom.mutateAsync({ id: r.id, photos: newPhotos } as any); } catch (err: any) { alert(err.message); }
                  }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
              ))}
              <label className="h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <span className="text-2xl text-muted-foreground">+</span>
                <span className="text-xs text-muted-foreground mt-1">Add Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  const newPaths: string[] = [];
                  for (const file of files) {
                    const ext = file.name.split('.').pop();
                    const path = `${r.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                    if (error) { alert(`Upload failed: ${error.message}`); continue; }
                    newPaths.push(path);
                  }
                  if (newPaths.length > 0) {
                    const updatedPhotos = [...(r.photos as string[] || []), ...newPaths];
                    updateField("photos", updatedPhotos);
                    try { await updateRoom.mutateAsync({ id: r.id, photos: updatedPhotos } as any); } catch (err: any) { alert(err.message); }
                  }
                  e.target.value = "";
                }} />
              </label>
            </div>
            </>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setEditingRoom(null)} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={saveRoom} disabled={updateRoom.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {updateRoom.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── UNIT FORM ───
  if (editingUnit) {
    const u = editingUnit;
    const updateField = (field: string, value: any) => setEditingUnit({ ...u, [field]: value });


    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setEditingUnit(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
          <div className="text-2xl font-extrabold">{u.id ? "Edit Unit" : "Add Unit"}</div>
          <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <input className={inputClass} placeholder="Building name" value={u.building} onChange={e => updateField("building", e.target.value)} />
              <input className={inputClass} placeholder="Unit (e.g. A-17-8)" value={u.unit} onChange={e => updateField("unit", e.target.value)} />
              <input className={inputClass} placeholder="Location" value={u.location} onChange={e => updateField("location", e.target.value)} />
              <select className={inputClass} value={u.unit_type} onChange={e => updateField("unit_type", e.target.value)}>
                <option>Mix Unit</option><option>Female Unit</option><option>Male Unit</option>
              </select>
              <input className={inputClass} type="number" placeholder="Maximum Pax" value={u.unit_max_pax} onChange={e => updateField("unit_max_pax", Number(e.target.value))} />
              <input className={inputClass} placeholder="Main Door Passcode" value={u.passcode} onChange={e => updateField("passcode", e.target.value)} />
              <select className={inputClass} value={u.access_card_source} onChange={e => updateField("access_card_source", e.target.value)}>
                <option value="Provided by Us">Access Card: Provided by Us</option>
                <option value="Management Office">Access Card: Management Office</option>
              </select>
              <input className={inputClass} type="number" placeholder="Access Card Deposit (RM)" value={u.access_card_deposit} onChange={e => updateField("access_card_deposit", Number(e.target.value))} />
              <input className={inputClass} placeholder="Deposit (e.g. 1.5 month)" value={u.deposit || ""} onChange={e => updateField("deposit", e.target.value)} />
              <select className={inputClass} value={u.meter_type || "Postpaid"} onChange={e => updateField("meter_type", e.target.value)}>
                <option value="Postpaid">Meter: Postpaid</option>
                <option value="Prepaid">Meter: Prepaid</option>
              </select>
              <input className={inputClass} type="number" step="0.01" placeholder="Meter Rate (RM per kWh)" value={u.meter_rate || ""} onChange={e => updateField("meter_rate", Number(e.target.value))} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={u.internal_only || false} onChange={e => updateField("internal_only", e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium">Internal Only (hidden from external agents)</span>
              </label>
            </div>
            <div className="text-lg font-semibold pt-2">Access Info</div>
            <textarea className={inputClass + " min-h-[80px]"} placeholder="Access info (e.g. condo entry, unit access, visitor parking, viewing instructions...)" value={u.access_info || ""} onChange={e => updateField("access_info", e.target.value)} />
            {/* Room configs - only for new units */}
            {!u.id && (() => {
              const regularRooms = roomConfigs.filter(rc => rc.room_type !== "Car Park");
              const carParks = roomConfigs.filter(rc => rc.room_type === "Car Park");
              const relabelRooms = (configs: RoomConfig[]) => {
                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                let roomIdx = 0, cpIdx = 0;
                return configs.map(r => {
                  if (r.room_type === "Car Park") {
                    cpIdx++;
                    return { ...r, room: cpIdx === 1 ? "Car Park" : `Car Park ${cpIdx}` };
                  }
                  const name = roomIdx < 26 ? `Room ${letters[roomIdx]}` : `Room ${roomIdx + 1}`;
                  roomIdx++;
                  return { ...r, room: name };
                });
              };
              return (
              <>
                <div className="flex items-center justify-between pt-2">
                  <div className="text-lg font-semibold">Room Details ({regularRooms.length} rooms, {carParks.length} car parks)</div>
                  <div className="flex gap-2">
                    {roomConfigs.length > 1 && (
                      <button type="button" onClick={() => setRoomConfigs(relabelRooms(roomConfigs.slice(0, -1)))} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                        − Remove Last
                      </button>
                    )}
                    <button type="button" onClick={() => {
                      setRoomConfigs(relabelRooms([...roomConfigs, { room: "", bed_type: "", max_pax: 1, rent: 0 }]));
                    }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      + Add Room
                    </button>
                    <button type="button" onClick={() => {
                      setRoomConfigs(relabelRooms([...roomConfigs, { room: "", bed_type: "", max_pax: 0, rent: 0, room_type: "Car Park" }]));
                    }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      🅿️ + Add Car Park
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {roomConfigs.map((rc, i) => {
                    const isCarPark = rc.room_type === "Car Park";
                    return (
                    <div key={i} className={`rounded-lg border p-4 ${isCarPark ? "bg-blue-500/5 border-blue-500/20" : "bg-secondary/30"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold">{isCarPark ? `🅿️ ${rc.room}` : rc.room}</div>
                        {roomConfigs.length > 1 && (
                          <button type="button" onClick={() => {
                            setRoomConfigs(relabelRooms(roomConfigs.filter((_, idx) => idx !== i)));
                          }} className="text-xs text-destructive hover:underline">Remove</button>
                        )}
                      </div>
                      {isCarPark ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Parking Lot</label>
                            <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={rc.parking_lot || ""} onChange={e => { const c = [...roomConfigs]; c[i] = { ...c[i], parking_lot: e.target.value }; setRoomConfigs(c); }} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Rent (RM)</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => { const c = [...roomConfigs]; c[i] = { ...c[i], rent: Number(e.target.value) }; setRoomConfigs(c); }} />
                          </div>
                        </div>
                      ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Bed Type</label>
                          <select className={`${inputClass} w-full`} value={rc.bed_type} onChange={e => { const c = [...roomConfigs]; const bt = e.target.value; c[i] = { ...c[i], bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 }; setRoomConfigs(c); }}>
                            <option value="">—</option><option>MASTER</option><option>QUEEN</option><option>QUEEN BALCONY</option><option>MEDIUM</option><option>SINGLE</option><option>SUPER SINGLE</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Max Pax</label>
                          <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => { const c = [...roomConfigs]; c[i] = { ...c[i], max_pax: Number(e.target.value) }; setRoomConfigs(c); }} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rent (RM)</label>
                          <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => { const c = [...roomConfigs]; c[i] = { ...c[i], rent: Number(e.target.value) }; setRoomConfigs(c); }} />
                        </div>
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </>
              );
            })()}
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setEditingUnit(null)} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={saveUnit} disabled={createUnit.isPending || updateUnit.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {(createUnit.isPending || updateUnit.isPending) ? "Saving..." : "Save Unit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Dashboard</button>
        <div>
          <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
          <div className="text-3xl font-extrabold tracking-tight mt-1">Admin Panel</div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab("dashboard")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "dashboard" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Dashboard</button>
          <button onClick={() => setTab("units")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "units" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Units & Rooms</button>
          <button onClick={() => setTab("claims")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "claims" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Claims {allClaims.filter(c => c.status === "pending").length > 0 ? `(${allClaims.filter(c => c.status === "pending").length})` : ""}</button>
          <button onClick={() => setTab("users")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Users</button>
        </div>

        {error && <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>}

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (() => {
          const pendingBookings = allBookings.filter(b => b.status === "pending");
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
              setSelectedBooking(null);
            } catch (e: any) { alert(e.message); }
          };

          const handleReject = async (booking: Booking) => {
            if (!user || !rejectReason.trim()) { alert("Please enter a reject reason"); return; }
            try {
              await updateBookingStatus.mutateAsync({ id: booking.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason, carParkIds: ((booking as any).documents as any)?.carParkIds || [] });
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${b.status === "pending" ? "bg-yellow-500/20 text-yellow-600" : b.status === "approved" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>{b.status.toUpperCase()}</span>
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

                  {b.status === "pending" && (
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

        {/* UNITS TAB */}
        {tab === "units" && (() => {
          const allLocations = Array.from(new Set(units.map(u => u.location).filter(Boolean))).sort();
          const allBuildings = Array.from(new Set(units.filter(u => unitFilters.location === "All" || u.location === unitFilters.location).map(u => u.building).filter(Boolean))).sort();
          const filteredUnits = units.filter(unit => {
            if (unitFilters.location !== "All" && unit.location !== unitFilters.location) return false;
            if (unitFilters.building !== "All" && unit.building !== unitFilters.building) return false;
            if (unitFilters.unitType !== "All" && unit.unit_type !== unitFilters.unitType) return false;
            if (unitFilters.price !== "All") {
              const minRent = Math.min(...(unit.rooms?.filter(r => r.room_type !== "Car Park").map(r => r.rent) ?? [0]));
              if (unitFilters.price === "Below RM700" && minRent >= 700) return false;
              if (unitFilters.price === "RM700 - RM900" && (minRent < 700 || minRent > 900)) return false;
              if (unitFilters.price === "Above RM900" && minRent <= 900) return false;
            }
            return true;
          });
          return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{filteredUnits.length} of {units.length} units</span>
              <button onClick={openCreateRoom2} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">+ Add Unit</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <select className={inputClass} value={unitFilters.location} onChange={e => setUnitFilters({ ...unitFilters, location: e.target.value, building: "All" })}>
                <option value="All">All Areas</option>
                {allLocations.map(l => <option key={l}>{l}</option>)}
              </select>
              <select className={inputClass} value={unitFilters.building} onChange={e => setUnitFilters({ ...unitFilters, building: e.target.value })}>
                <option value="All">All Properties</option>
                {allBuildings.map(b => <option key={b}>{b}</option>)}
              </select>
              <select className={inputClass} value={unitFilters.price} onChange={e => setUnitFilters({ ...unitFilters, price: e.target.value })}>
                <option value="All">All Prices</option>
                <option>Below RM700</option><option>RM700 - RM900</option><option>Above RM900</option>
              </select>
              <select className={inputClass} value={unitFilters.unitType} onChange={e => setUnitFilters({ ...unitFilters, unitType: e.target.value })}>
                <option value="All">All Gender</option>
                <option>Female Unit</option><option>Mix Unit</option><option>Male Unit</option>
              </select>
            </div>
            {unitsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-3">
                {filteredUnits.map((unit) => {
                  const isExpanded = expandedUnit === unit.id;
                  const regularRooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
                  const carParks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
                  const availableCount = regularRooms.filter(r => r.status === "Available").length;
                  const availableCP = carParks.filter(r => r.status === "Available").length;
                  return (
                    <div key={unit.id} className="bg-card rounded-lg shadow-sm overflow-hidden">
                      <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}>
                        <div>
                          <div className="text-lg font-semibold">{unit.building} {unit.unit}</div>
                          <div className="text-sm text-muted-foreground mt-1">{unit.location} • {unit.unit_type} • Maximum {unit.unit_max_pax} Pax</div>
                          <div className="flex gap-2 flex-wrap mt-2">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent text-accent-foreground">{availableCount} rooms avail</span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">{regularRooms.length - availableCount} tenanted</span>
                            {carParks.length > 0 && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">🅿️ {availableCP}/{carParks.length} car parks</span>}
                            {unit.passcode && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">🔑 {unit.passcode}</span>}
                            {(unit as any).access_card_source && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">🪪 {(unit as any).access_card_source} {(unit as any).access_card_deposit ? `RM${(unit as any).access_card_deposit}` : ""}</span>}
                            {(unit as any).deposit && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">💰 Deposit: {(unit as any).deposit}</span>}
                            {(unit as any).meter_type && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">⚡ {(unit as any).meter_type} {(unit as any).meter_rate ? `RM${(unit as any).meter_rate}/kWh` : ""}</span>}
                            {(unit as any).internal_only && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary">🔒 Internal Only</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setEditingUnit({ id: unit.id, building: unit.building, unit: unit.unit, location: unit.location, unit_type: unit.unit_type, unit_max_pax: unit.unit_max_pax, passcode: unit.passcode || "", access_card: unit.access_card || "", parking_lot: unit.parking_lot || "", access_card_source: (unit as any).access_card_source || "Provided by Us", access_card_deposit: (unit as any).access_card_deposit || 0, access_info: typeof unit.access_info === 'string' ? unit.access_info : "", internal_only: (unit as any).internal_only || false, deposit: (unit as any).deposit || "", meter_type: (unit as any).meter_type || "Postpaid", meter_rate: (unit as any).meter_rate || 0 }); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Edit</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Delete</button>
                          <span className="text-muted-foreground text-lg">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {isExpanded && unit.rooms && (
                        <div className="border-t">
                          {/* Common Area Photos */}
                          <div className="p-4 border-b bg-secondary/20">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-semibold">🏠 Common Area Photos</div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {((unit as any).common_photos as string[] || []).map((path: string, i: number) => (
                                <div key={i} className="relative group">
                                  <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-24 w-24 object-cover rounded-lg" />
                                  <button onClick={async () => {
                                    const newPhotos = ((unit as any).common_photos as string[]).filter((_: string, idx: number) => idx !== i);
                                    try { await updateUnit.mutateAsync({ id: unit.id, common_photos: newPhotos } as any); } catch (e: any) { alert(e.message); }
                                  }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                </div>
                              ))}
                              <label className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                <span className="text-xl text-muted-foreground">+</span>
                                <span className="text-[10px] text-muted-foreground">Add</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  const newPaths: string[] = [];
                                  for (const file of files) {
                                    const ext = file.name.split('.').pop();
                                    const path = `common/${unit.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                                    if (error) { alert(`Upload failed: ${error.message}`); continue; }
                                    newPaths.push(path);
                                  }
                                  if (newPaths.length > 0) {
                                    const existing = ((unit as any).common_photos as string[] || []);
                                    try { await updateUnit.mutateAsync({ id: unit.id, common_photos: [...existing, ...newPaths] } as any); } catch (e: any) { alert(e.message); }
                                  }
                                  e.target.value = "";
                                }} />
                              </label>
                            </div>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-secondary/50">
                                <th className="text-left px-4 py-2 font-medium">Room</th>
                                <th className="text-left px-4 py-2 font-medium">Bed Type</th>
                                <th className="text-left px-4 py-2 font-medium">Pax</th>
                                <th className="text-left px-4 py-2 font-medium">Rent</th>
                                <th className="text-left px-4 py-2 font-medium">Tenant</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-right px-4 py-2 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unit.rooms.map((room) => {
                                const isCP = room.room_type === "Car Park";
                                return (
                                <tr key={room.id} className={`border-t hover:bg-secondary/30 transition-colors ${isCP ? "bg-blue-500/5" : ""}`}>
                                  <td className="px-4 py-3 font-medium">{isCP ? `🅿️ ${room.room}` : room.room}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{isCP ? (room.bed_type ? `Lot: ${room.bed_type}` : "—") : (room.bed_type || "—")}</td>
                                  <td className="px-4 py-3">
                                    {isCP ? "—" : (
                                    <select className="bg-secondary rounded px-2 py-1 text-xs font-medium" value={room.pax_staying || 0} onChange={async (e) => {
                                      try { await updateRoom.mutateAsync({ id: room.id, pax_staying: Number(e.target.value) }); } catch (err: any) { alert(err.message); }
                                    }}>
                                      {Array.from({ length: room.max_pax + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">{room.rent > 0 ? `RM${room.rent}` : "—"}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{isCP ? (room.tenant_gender || "—") : ([room.tenant_race, room.tenant_gender].filter(Boolean).join(" ") || "—")}</td>
                                  <td className="px-4 py-3">
                                    <button onClick={() => toggleRoomStatus(room)} className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${room.status === "Available" ? "bg-accent/50 text-accent-foreground hover:bg-accent" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>
                                      {room.status}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <button onClick={() => setEditingRoom(room)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Edit</button>
                                      {isCP && <button onClick={async () => { if (confirm("Delete this car park?")) { try { await deleteRoom.mutateAsync(room.id); } catch (e: any) { alert(e.message); } } }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Delete</button>}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                              {/* Balance pax summary */}
                              <tr className="border-t bg-secondary/30 font-semibold">
                                <td className="px-4 py-2" colSpan={2}>Balance Pax</td>
                                <td className="px-4 py-2">{unit.unit_max_pax - (unit.rooms?.filter(r => r.room_type !== "Car Park").reduce((sum, r) => sum + (r.pax_staying || 0), 0) ?? 0)}</td>
                                <td colSpan={4} className="px-4 py-2 text-right">
                                  <button onClick={async () => {
                                    const cpCount = (unit.rooms?.filter(r => r.room_type === "Car Park").length ?? 0) + 1;
                                    try {
                                      await createRoom.mutateAsync({
                                        unit_id: unit.id,
                                        building: unit.building,
                                        unit: unit.unit,
                                        room: cpCount === 1 ? "Car Park" : `Car Park ${cpCount}`,
                                        location: unit.location,
                                        rent: 0,
                                        bed_type: "",
                                        room_type: "Car Park",
                                        unit_type: unit.unit_type,
                                        status: "Available",
                                        available_date: "Available Now",
                                        max_pax: 0,
                                        occupied_pax: 0,
                                        pax_staying: 0,
                                        unit_max_pax: unit.unit_max_pax,
                                        unit_occupied_pax: 0,
                                        housemates: [],
                                        photos: [],
                                        access_info: unit.access_info,
                                        move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
                                        tenant_gender: "",
                                        tenant_race: "",
                                        internal_only: (unit as any).internal_only || false,
                                      });
                                    } catch (e: any) { alert(e.message); }
                                  }} disabled={createRoom.isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                    🅿️ + Add Car Park
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {/* CLAIMS TAB */}
        {tab === "claims" && (() => {
          const pendingClaims = allClaims.filter(c => c.status === "pending");
          const processedClaims = allClaims.filter(c => c.status !== "pending");

          const handleApproveClaim = async (claim: Claim) => {
            if (!user) return;
            try {
              await updateClaimStatus.mutateAsync({ id: claim.id, status: "approved", reviewed_by: user.id });
            } catch (e: any) { alert(e.message); }
          };

          const handleRejectClaim = async (claim: Claim) => {
            if (!user || !claimRejectReason.trim()) { alert("Please enter a reject reason"); return; }
            try {
              await updateClaimStatus.mutateAsync({ id: claim.id, status: "rejected", reviewed_by: user.id, reject_reason: claimRejectReason });
              setClaimRejectReason("");
            } catch (e: any) { alert(e.message); }
          };

          const renderClaimCard = (c: Claim, showActions: boolean) => {
            const linkedBooking = allBookings.find(b => b.id === c.booking_id);
            return (
              <div key={c.id} className="bg-card rounded-lg shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-lg">RM{Number(c.amount).toLocaleString()}</div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.status === "pending" ? "bg-yellow-500/20 text-yellow-600" : c.status === "approved" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>{c.status.toUpperCase()}</span>
                </div>
                {linkedBooking && (
                  <div className="bg-secondary rounded-lg p-3 text-sm space-y-1">
                    <div className="font-semibold">📋 Booking: {linkedBooking.room?.building} {linkedBooking.room?.unit} {linkedBooking.room?.room}</div>
                    <div className="text-muted-foreground">Tenant: {linkedBooking.tenant_name} · {linkedBooking.tenant_phone}</div>
                    <div className="text-muted-foreground">Move-in: {new Date(linkedBooking.move_in_date).toLocaleDateString()} · {linkedBooking.contract_months} months</div>
                  </div>
                )}
                {!linkedBooking && c.booking_id && <div className="text-xs text-muted-foreground">Booking ID: {c.booking_id.slice(0, 8)}...</div>}
                <div className="text-sm text-muted-foreground">{c.description}</div>
                {c.bank_name && <div className="text-xs text-muted-foreground">🏦 {c.bank_name} · {c.bank_account} · {c.account_holder}</div>}
                <div className="text-xs text-muted-foreground">Agent: {c.agent_id.slice(0, 8)}... · {new Date(c.created_at).toLocaleDateString()}</div>
                {c.reject_reason && <div className="text-xs text-destructive">Reason: {c.reject_reason}</div>}
                {showActions && c.status === "pending" && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <button onClick={() => handleApproveClaim(c)} disabled={updateClaimStatus.isPending} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">✅ Approve</button>
                    <div className="flex gap-2">
                      <input className="flex-1 px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground text-sm placeholder:text-muted-foreground" placeholder="Reject reason..." value={claimRejectReason} onChange={e => setClaimRejectReason(e.target.value)} />
                      <button onClick={() => handleRejectClaim(c)} disabled={updateClaimStatus.isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">❌ Reject</button>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-yellow-500">{pendingClaims.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Pending</div>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-green-600">RM{allClaims.filter(c => c.status === "approved").reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Approved</div>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold">{allClaims.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Claims</div>
                </div>
              </div>

              <div>
                <div className="text-lg font-bold mb-3">🔔 Pending Claims</div>
                {pendingClaims.length === 0 ? (
                  <div className="bg-card rounded-lg p-6 text-center text-muted-foreground text-sm">No pending claims</div>
                ) : (
                  <div className="space-y-3">{pendingClaims.map(c => renderClaimCard(c, true))}</div>
                )}
              </div>

              {processedClaims.length > 0 && (
                <div>
                  <div className="text-lg font-bold mb-3">📋 Processed Claims</div>
                  <div className="space-y-3">{processedClaims.slice(0, 20).map(c => renderClaimCard(c, false))}</div>
                </div>
              )}
            </div>
          );
        })()}

        {tab === "users" && (
          <div className="space-y-4">
            {users.map((u) => {
              const isAdmin = u.roles.includes("admin");
              const isAgent = u.roles.includes("agent");
              const isEditing = editingCommission === u.id;
              const config = u.commission_config || defaultConfigs[u.commission_type] || defaultConfigs.internal_basic;

              const commSummary = () => {
                const ct = u.commission_type;
                if (ct === "external") return `External — ${config.percentage ?? 100}% of rent`;
                if (ct === "internal_full") {
                  const tiers = config.tiers || [];
                  return `Internal Full — ${tiers.map(t => `${t.min}-${t.max ?? "∞"} deals: ${t.percentage}%`).join(", ")}`;
                }
                const tiers = config.tiers || [];
                return `Internal Basic — ${tiers.map(t => `${t.min}-${t.max ?? "∞"} deals: RM${t.amount}`).join(", ")}`;
              };

              return (
                <div key={u.id} className="bg-card rounded-lg shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{u.email}</div>
                      <div className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.roles.map((r) => (<span key={r} className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-semibold uppercase">{r}</span>))}
                      <button onClick={() => toggleRole(u.id, "admin", isAdmin)} disabled={updating === u.id + "admin" || u.id === user?.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAdmin ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>{isAdmin ? "Remove Admin" : "Make Admin"}</button>
                      <button onClick={() => toggleRole(u.id, "agent", isAgent)} disabled={updating === u.id + "agent"} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAgent ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>{isAgent ? "Remove Agent" : "Make Agent"}</button>
                    </div>
                  </div>

                  {isAgent && !isEditing && (
                    <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                      <div className="text-sm">{commSummary()}</div>
                      <button onClick={() => {
                        setEditingCommission(u.id);
                        setCommissionDraft({ type: u.commission_type, config: { ...config, tiers: config.tiers ? config.tiers.map(t => ({ ...t })) : undefined } });
                      }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Edit Commission</button>
                    </div>
                  )}

                  {isAgent && isEditing && (
                    <div className="bg-secondary rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                        <select className={`${inputClass}`} value={commissionDraft.type} onChange={e => {
                          const newType = e.target.value;
                          setCommissionDraft({ type: newType, config: { ...defaultConfigs[newType] } });
                        }}>
                          <option value="external">External</option>
                          <option value="internal_basic">Internal Basic</option>
                          <option value="internal_full">Internal Full</option>
                        </select>
                      </div>

                      {commissionDraft.type === "external" && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Commission %</label>
                          <input className={`${inputClass} w-24`} type="number" value={commissionDraft.config.percentage ?? 100} onChange={e => setCommissionDraft({ ...commissionDraft, config: { percentage: Number(e.target.value) } })} />
                          <span className="text-xs text-muted-foreground">% of monthly rent</span>
                        </div>
                      )}

                      {(commissionDraft.type === "internal_basic" || commissionDraft.type === "internal_full") && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase">Tiers (by deals per month)</div>
                          {(commissionDraft.config.tiers || []).map((tier, i) => (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                              <input className={`${inputClass} w-20`} type="number" placeholder="From" value={tier.min} onChange={e => {
                                const tiers = [...(commissionDraft.config.tiers || [])];
                                tiers[i] = { ...tiers[i], min: Number(e.target.value) };
                                setCommissionDraft({ ...commissionDraft, config: { tiers } });
                              }} />
                              <span className="text-xs text-muted-foreground">to</span>
                              <input className={`${inputClass} w-20`} type="number" placeholder="∞" value={tier.max ?? ""} onChange={e => {
                                const tiers = [...(commissionDraft.config.tiers || [])];
                                tiers[i] = { ...tiers[i], max: e.target.value ? Number(e.target.value) : null };
                                setCommissionDraft({ ...commissionDraft, config: { tiers } });
                              }} />
                              <span className="text-xs text-muted-foreground">deals →</span>
                              {commissionDraft.type === "internal_basic" ? (
                                <>
                                  <span className="text-xs text-muted-foreground">RM</span>
                                  <input className={`${inputClass} w-24`} type="number" value={tier.amount ?? 0} onChange={e => {
                                    const tiers = [...(commissionDraft.config.tiers || [])];
                                    tiers[i] = { ...tiers[i], amount: Number(e.target.value) };
                                    setCommissionDraft({ ...commissionDraft, config: { tiers } });
                                  }} />
                                </>
                              ) : (
                                <>
                                  <input className={`${inputClass} w-20`} type="number" value={tier.percentage ?? 0} onChange={e => {
                                    const tiers = [...(commissionDraft.config.tiers || [])];
                                    tiers[i] = { ...tiers[i], percentage: Number(e.target.value) };
                                    setCommissionDraft({ ...commissionDraft, config: { tiers } });
                                  }} />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </>
                              )}
                              <button onClick={() => {
                                const tiers = (commissionDraft.config.tiers || []).filter((_, idx) => idx !== i);
                                setCommissionDraft({ ...commissionDraft, config: { tiers } });
                              }} className="px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10">✕</button>
                            </div>
                          ))}
                          <button onClick={() => {
                            const tiers = [...(commissionDraft.config.tiers || [])];
                            const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max ?? 0) + 1 : 1;
                            tiers.push({ min: lastMax, max: null, ...(commissionDraft.type === "internal_basic" ? { amount: 0 } : { percentage: 0 }) });
                            setCommissionDraft({ ...commissionDraft, config: { tiers } });
                          }} className="text-xs text-primary hover:underline">+ Add Tier</button>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2">
                        <button onClick={() => setEditingCommission(null)} className="px-4 py-2 rounded-lg border text-foreground text-sm hover:bg-background transition-colors">Cancel</button>
                        <button onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("user_roles")
                              .update({ commission_type: commissionDraft.type, commission_config: commissionDraft.config as any })
                              .eq("user_id", u.id)
                              .eq("role", "agent");
                            if (error) throw error;
                            setEditingCommission(null);
                            await fetchUsers();
                          } catch (err: any) {
                            alert(err.message || "Failed to save");
                          }
                        }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Save</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

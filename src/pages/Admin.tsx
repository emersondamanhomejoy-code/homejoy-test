import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useUpdateRoom, Unit, Room, RoomConfig } from "@/hooks/useRooms";

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

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
  access_info: { condoEntry: "", unitAccess: "", visitorParking: "", viewing: "" },
};

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "units">("units");

  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Units state
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const updateRoom = useUpdateRoom();
  const [editingUnit, setEditingUnit] = useState<typeof emptyUnit & { id?: string } | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(defaultRoomConfigs);

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
    const updateField = (field: string, value: any) => setEditingRoom({ ...r, [field]: value });
    const updateCost = (field: string, value: number) => setEditingRoom({ ...r, move_in_cost: { ...r.move_in_cost, [field]: value } });

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setEditingRoom(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
          <div className="text-2xl font-extrabold">Edit {r.room}</div>
          <div className="text-muted-foreground text-sm">{r.building} {r.unit}</div>
          <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="text-xs text-muted-foreground">Bed Type</label>
                <select className={`${inputClass} w-full`} value={r.bed_type || ""} onChange={e => updateField("bed_type", e.target.value)}>
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
            <div className="text-lg font-semibold pt-2">Move-in Cost (RM)</div>
            <div className="grid md:grid-cols-4 gap-4">
              <div><label className="text-xs text-muted-foreground">Advance</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.advance ?? 0} onChange={e => updateCost("advance", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Deposit</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.deposit ?? 0} onChange={e => updateCost("deposit", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Access Card</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.accessCard ?? 0} onChange={e => updateCost("accessCard", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Move-in Fee</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.moveInFee ?? 0} onChange={e => updateCost("moveInFee", Number(e.target.value))} /></div>
            </div>
            <div className="text-sm text-muted-foreground">Total: RM{(r.move_in_cost?.advance || 0) + (r.move_in_cost?.deposit || 0) + (r.move_in_cost?.accessCard || 0) + (r.move_in_cost?.moveInFee || 0)}</div>
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
    const updateAccess = (field: string, value: string) => setEditingUnit({ ...u, access_info: { ...u.access_info, [field]: value } });

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
              <input className={inputClass} type="number" placeholder="Max Pax" value={u.unit_max_pax} onChange={e => updateField("unit_max_pax", Number(e.target.value))} />
              <input className={inputClass} placeholder="Main Door Passcode" value={u.passcode} onChange={e => updateField("passcode", e.target.value)} />
              <input className={inputClass} placeholder="Access Card Price (RM)" value={u.access_card} onChange={e => updateField("access_card", e.target.value)} />
              <input className={inputClass} placeholder="Parking Lot" value={u.parking_lot} onChange={e => updateField("parking_lot", e.target.value)} />
            </div>
            <div className="text-lg font-semibold pt-2">Access Info</div>
            <div className="grid md:grid-cols-2 gap-4">
              <input className={inputClass} placeholder="Condo Entry" value={u.access_info.condoEntry} onChange={e => updateAccess("condoEntry", e.target.value)} />
              <input className={inputClass} placeholder="Unit Access" value={u.access_info.unitAccess} onChange={e => updateAccess("unitAccess", e.target.value)} />
              <input className={inputClass} placeholder="Visitor Parking" value={u.access_info.visitorParking} onChange={e => updateAccess("visitorParking", e.target.value)} />
              <input className={inputClass} placeholder="Viewing" value={u.access_info.viewing} onChange={e => updateAccess("viewing", e.target.value)} />
            </div>
            {/* Room configs - only for new units */}
            {!u.id && (
              <>
                <div className="text-lg font-semibold pt-2">Room Details</div>
                <div className="space-y-3">
                  {roomConfigs.map((rc, i) => (
                    <div key={rc.room} className="rounded-lg border bg-secondary/30 p-4">
                      <div className="text-sm font-semibold mb-3">{rc.room}</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Bed Type</label>
                          <select className={`${inputClass} w-full`} value={rc.bed_type} onChange={e => { const c = [...roomConfigs]; c[i] = { ...c[i], bed_type: e.target.value }; setRoomConfigs(c); }}>
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
                    </div>
                  ))}
                </div>
              </>
            )}
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
          <button onClick={() => setTab("units")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "units" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Units & Rooms</button>
          <button onClick={() => setTab("users")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>Users</button>
        </div>

        {error && <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>}

        {/* UNITS TAB */}
        {tab === "units" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{units.length} units</span>
              <button onClick={openCreateRoom2} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">+ Add Unit</button>
            </div>
            {unitsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-3">
                {units.map((unit) => {
                  const isExpanded = expandedUnit === unit.id;
                  const availableCount = unit.rooms?.filter(r => r.status === "Available").length ?? 0;
                  const totalRooms = unit.rooms?.length ?? 0;
                  return (
                    <div key={unit.id} className="bg-card rounded-lg shadow-sm overflow-hidden">
                      <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}>
                        <div>
                          <div className="text-lg font-semibold">{unit.building} {unit.unit}</div>
                          <div className="text-sm text-muted-foreground mt-1">{unit.location} • {unit.unit_type} • Max {unit.unit_max_pax} pax</div>
                          <div className="flex gap-2 flex-wrap mt-2">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent text-accent-foreground">{availableCount} available</span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">{totalRooms - availableCount} tenanted</span>
                            {unit.passcode && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">🔑 {unit.passcode}</span>}
                            {unit.access_card && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">🪪 {unit.access_card}</span>}
                            {unit.parking_lot && <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">🅿️ {unit.parking_lot}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setEditingUnit({ id: unit.id, building: unit.building, unit: unit.unit, location: unit.location, unit_type: unit.unit_type, unit_max_pax: unit.unit_max_pax, passcode: unit.passcode || "", access_card: unit.access_card || "", parking_rate: unit.parking_rate || "", access_info: unit.access_info }); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Edit</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Delete</button>
                          <span className="text-muted-foreground text-lg">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {isExpanded && unit.rooms && (
                        <div className="border-t">
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
                              {unit.rooms.map((room) => (
                                <tr key={room.id} className="border-t hover:bg-secondary/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">{room.room}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{room.bed_type || "—"}</td>
                                  <td className="px-4 py-3">{room.pax_staying || 0}</td>
                                  <td className="px-4 py-3">{room.rent > 0 ? `RM${room.rent}` : "—"}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{[room.tenant_race, room.tenant_gender].filter(Boolean).join(" ") || "—"}</td>
                                  <td className="px-4 py-3">
                                    <button onClick={() => toggleRoomStatus(room)} className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${room.status === "Available" ? "bg-accent/50 text-accent-foreground hover:bg-accent" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>
                                      {room.status}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button onClick={() => setEditingRoom(room)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Edit</button>
                                  </td>
                                </tr>
                              ))}
                              {/* Balance pax summary */}
                              <tr className="border-t bg-secondary/30 font-semibold">
                                <td className="px-4 py-2" colSpan={2}>Balance Pax</td>
                                <td className="px-4 py-2">{unit.unit_max_pax - (unit.rooms?.reduce((sum, r) => sum + (r.pax_staying || 0), 0) ?? 0)}</td>
                                <td colSpan={4}></td>
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
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="bg-card rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary">
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold">Joined</th>
                  <th className="text-left px-5 py-3 font-semibold">Roles</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = u.roles.includes("admin");
                  const isAgent = u.roles.includes("agent");
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/50 transition-colors">
                      <td className="px-5 py-4 font-medium">{u.email}</td>
                      <td className="px-5 py-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {u.roles.map((r) => (<span key={r} className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-semibold uppercase">{r}</span>))}
                          {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => toggleRole(u.id, "admin", isAdmin)} disabled={updating === u.id + "admin" || u.id === user?.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAdmin ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>{isAdmin ? "Remove Admin" : "Make Admin"}</button>
                          <button onClick={() => toggleRole(u.id, "agent", isAgent)} disabled={updating === u.id + "agent"} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAgent ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>{isAgent ? "Remove Agent" : "Make Agent"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

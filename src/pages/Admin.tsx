import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useRooms, useUpsertRoom, useDeleteRoom, Room } from "@/hooks/useRooms";

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const emptyRoom = {
  building: "", unit: "", room: "", location: "", rent: 0,
  room_type: "Medium Room", unit_type: "Mix Unit", status: "Available",
  available_date: "Available Now", max_pax: 1, occupied_pax: 0,
  unit_max_pax: 6, unit_occupied_pax: 0,
  housemates: [] as string[], photos: [] as string[],
  access_info: { condoEntry: "", unitAccess: "", visitorParking: "", viewing: "" },
  move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
};

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "rooms">("rooms");

  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Rooms state
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const upsertRoom = useUpsertRoom();
  const deleteRoom = useDeleteRoom();
  const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
  const [housemateInput, setHousemateInput] = useState("");

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      navigate("/");
    }
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (user && role === "admin") {
      fetchUsers();
    }
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

  const openCreateRoom = () => {
    setEditingRoom({ ...emptyRoom });
    setHousemateInput("");
  };

  const openEditRoom = (room: Room) => {
    setEditingRoom({ ...room });
    setHousemateInput((room.housemates || []).join("\n"));
  };

  const saveRoom = async () => {
    if (!editingRoom) return;
    const housemates = housemateInput.split("\n").map(s => s.trim()).filter(Boolean);
    const total = (editingRoom.move_in_cost?.advance || 0) + (editingRoom.move_in_cost?.deposit || 0) + (editingRoom.move_in_cost?.accessCard || 0) + (editingRoom.move_in_cost?.moveInFee || 0);
    try {
      await upsertRoom.mutateAsync({
        ...editingRoom,
        housemates,
        move_in_cost: { ...editingRoom.move_in_cost!, total },
      } as any);
      setEditingRoom(null);
    } catch (e: any) {
      alert(e.message || "Failed to save room");
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm("Delete this room?")) return;
    try {
      await deleteRoom.mutateAsync(id);
    } catch (e: any) {
      alert(e.message || "Failed to delete room");
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

  // ─── ROOM FORM ───
  if (editingRoom) {
    const r = editingRoom;
    const updateField = (field: string, value: any) => setEditingRoom({ ...r, [field]: value });
    const updateAccess = (field: string, value: string) => setEditingRoom({ ...r, access_info: { ...r.access_info!, [field]: value } });
    const updateCost = (field: string, value: number) => setEditingRoom({ ...r, move_in_cost: { ...r.move_in_cost!, [field]: value } });

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setEditingRoom(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Admin
          </button>
          <div className="text-2xl font-extrabold">{r.id ? "Edit Room" : "Add Room"}</div>
          <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
            <div className="text-lg font-semibold">Basic Info</div>
            <div className="grid md:grid-cols-2 gap-4">
              <input className={inputClass} placeholder="Building name" value={r.building || ""} onChange={e => updateField("building", e.target.value)} />
              <input className={inputClass} placeholder="Unit (e.g. A-17-8)" value={r.unit || ""} onChange={e => updateField("unit", e.target.value)} />
              <input className={inputClass} placeholder="Room (e.g. Room B)" value={r.room || ""} onChange={e => updateField("room", e.target.value)} />
              <input className={inputClass} placeholder="Location" value={r.location || ""} onChange={e => updateField("location", e.target.value)} />
              <input className={inputClass} type="number" placeholder="Rent (RM)" value={r.rent || ""} onChange={e => updateField("rent", Number(e.target.value))} />
              <select className={inputClass} value={r.room_type || "Medium Room"} onChange={e => updateField("room_type", e.target.value)}>
                <option>Single Room</option><option>Medium Room</option><option>Master Room</option>
              </select>
              <select className={inputClass} value={r.unit_type || "Mix Unit"} onChange={e => updateField("unit_type", e.target.value)}>
                <option>Mix Unit</option><option>Female Unit</option><option>Male Unit</option>
              </select>
              <select className={inputClass} value={r.status || "Available"} onChange={e => updateField("status", e.target.value)}>
                <option>Available</option><option>Booked</option><option>Unavailable</option>
              </select>
              <input className={inputClass} placeholder="Available date" value={r.available_date || ""} onChange={e => updateField("available_date", e.target.value)} />
            </div>

            <div className="text-lg font-semibold pt-4">Occupancy</div>
            <div className="grid md:grid-cols-4 gap-4">
              <div><label className="text-xs text-muted-foreground">Room Max Pax</label><input className={`${inputClass} w-full`} type="number" value={r.max_pax ?? 1} onChange={e => updateField("max_pax", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Room Occupied</label><input className={`${inputClass} w-full`} type="number" value={r.occupied_pax ?? 0} onChange={e => updateField("occupied_pax", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Unit Max Pax</label><input className={`${inputClass} w-full`} type="number" value={r.unit_max_pax ?? 6} onChange={e => updateField("unit_max_pax", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Unit Occupied</label><input className={`${inputClass} w-full`} type="number" value={r.unit_occupied_pax ?? 0} onChange={e => updateField("unit_occupied_pax", Number(e.target.value))} /></div>
            </div>

            <div className="text-lg font-semibold pt-4">Housemates</div>
            <textarea className={`${inputClass} w-full h-28`} placeholder="One per line, e.g. Room A: 1 Female" value={housemateInput} onChange={e => setHousemateInput(e.target.value)} />

            <div className="text-lg font-semibold pt-4">Access Info</div>
            <div className="grid md:grid-cols-2 gap-4">
              <input className={inputClass} placeholder="Condo Entry" value={r.access_info?.condoEntry || ""} onChange={e => updateAccess("condoEntry", e.target.value)} />
              <input className={inputClass} placeholder="Unit Access" value={r.access_info?.unitAccess || ""} onChange={e => updateAccess("unitAccess", e.target.value)} />
              <input className={inputClass} placeholder="Visitor Parking" value={r.access_info?.visitorParking || ""} onChange={e => updateAccess("visitorParking", e.target.value)} />
              <input className={inputClass} placeholder="Viewing" value={r.access_info?.viewing || ""} onChange={e => updateAccess("viewing", e.target.value)} />
            </div>

            <div className="text-lg font-semibold pt-4">Move-in Cost (RM)</div>
            <div className="grid md:grid-cols-4 gap-4">
              <div><label className="text-xs text-muted-foreground">Advance</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.advance ?? 0} onChange={e => updateCost("advance", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Deposit</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.deposit ?? 0} onChange={e => updateCost("deposit", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Access Card</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.accessCard ?? 0} onChange={e => updateCost("accessCard", Number(e.target.value))} /></div>
              <div><label className="text-xs text-muted-foreground">Move-in Fee</label><input className={`${inputClass} w-full`} type="number" value={r.move_in_cost?.moveInFee ?? 0} onChange={e => updateCost("moveInFee", Number(e.target.value))} /></div>
            </div>
            <div className="text-sm text-muted-foreground">Total: RM{(r.move_in_cost?.advance || 0) + (r.move_in_cost?.deposit || 0) + (r.move_in_cost?.accessCard || 0) + (r.move_in_cost?.moveInFee || 0)}</div>

            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setEditingRoom(null)} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={saveRoom} disabled={upsertRoom.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {upsertRoom.isPending ? "Saving..." : "Save Room"}
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
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1">Admin Panel</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab("rooms")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "rooms" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>
            Rooms
          </button>
          <button onClick={() => setTab("users")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>
            Users
          </button>
        </div>

        {error && <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>}

        {/* ROOMS TAB */}
        {tab === "rooms" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{rooms.length} rooms</span>
              <button onClick={openCreateRoom} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                + Add Room
              </button>
            </div>
            {roomsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading rooms...</div>
            ) : (
              <div className="bg-card rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary">
                      <th className="text-left px-5 py-3 font-semibold">Building / Unit</th>
                      <th className="text-left px-5 py-3 font-semibold">Room</th>
                      <th className="text-left px-5 py-3 font-semibold">Rent</th>
                      <th className="text-left px-5 py-3 font-semibold">Status</th>
                      <th className="text-right px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id} className="border-b last:border-0 hover:bg-secondary/50 transition-colors">
                        <td className="px-5 py-4 font-medium">{room.building} {room.unit}</td>
                        <td className="px-5 py-4 text-muted-foreground">{room.room}</td>
                        <td className="px-5 py-4">RM{room.rent}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${room.status === "Available" ? "bg-green-500/10 text-green-600" : "bg-secondary text-secondary-foreground"}`}>
                            {room.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => openEditRoom(room)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteRoom(room.id)} disabled={deleteRoom.isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                          {u.roles.map((r) => (
                            <span key={r} className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-semibold uppercase">{r}</span>
                          ))}
                          {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => toggleRole(u.id, "admin", isAdmin)} disabled={updating === u.id + "admin" || u.id === user?.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAdmin ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                            {isAdmin ? "Remove Admin" : "Make Admin"}
                          </button>
                          <button onClick={() => toggleRole(u.id, "agent", isAgent)} disabled={updating === u.id + "agent"} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${isAgent ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                            {isAgent ? "Remove Agent" : "Make Agent"}
                          </button>
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

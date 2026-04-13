import { useState, useEffect, useRef } from "react";
import { MoveInPage } from "@/components/MoveInPage";
import { UsersPage } from "@/components/UsersPage";
import { ActivityLogPage } from "@/components/ActivityLogPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useUpdateRoom, useCreateRoom, useDeleteRoom, Unit, Room, RoomConfig } from "@/hooks/useRooms";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { logActivity } from "@/hooks/useActivityLog";
import { logActivity } from "@/hooks/useActivityLog";
import { useCondos } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { UnitsTableView } from "@/components/UnitsTableView";
import { UnitsRoomsContent } from "@/components/UnitsRoomsContent";
import { StatusBadge } from "@/components/StatusBadge";
import { BookingsContent } from "@/components/BookingsContent";

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
  confirmed: boolean;
  roles: string[];
  commission_type: string;
  commission_config: CommissionConfig | null;
  name: string;
  phone: string;
  address: string;
}

const defaultConfigs: Record<string, CommissionConfig> = {
  external: { percentage: 100 },
  internal_basic: { tiers: [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }] },
  internal_full: { tiers: [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }] },
};

const bedTypeMaxPax: Record<string, number> = {
  Single: 1, "Super Single": 1, Queen: 2, King: 2,
  MASTER: 2, QUEEN: 2, "QUEEN BALCONY": 2, MEDIUM: 2, SINGLE: 1, "SUPER SINGLE": 1,
};

const getDefaultRoomName = (index: number, naming: "alpha" | "digit") =>
  naming === "alpha" ? `Room ${String.fromCharCode(65 + index)}` : `Room ${index + 1}`;

const getDefaultCarParkName = (index: number) => index === 0 ? "Car Park" : `Car Park ${index + 1}`;

const createDefaultRoomConfigs = (roomCount: number, carParkCount: number, naming: "alpha" | "digit"): RoomConfig[] => {
  const rooms: RoomConfig[] = Array.from({ length: roomCount }, (_, i) => ({
    room: getDefaultRoomName(i, naming),
    bed_type: "",
    max_pax: 1,
    rent: 0,
    status: "Available",
  }));
  const carParks: RoomConfig[] = Array.from({ length: carParkCount }, (_, i) => ({
    room: getDefaultCarParkName(i),
    bed_type: "",
    max_pax: 0,
    rent: 0,
    room_type: "Car Park",
  }));
  return [...rooms, ...carParks];
};

const hasMeaningfulRoomData = (room: RoomConfig, index: number, naming: "alpha" | "digit" = "alpha") => {
  if (room.room_type === "Car Park") {
    return Boolean(room.bed_type?.trim()) || Number(room.rent) > 0 || (room.room && room.room !== getDefaultCarParkName(index));
  }

  return (
    Boolean(room.bed_type?.trim()) ||
    Number(room.rent) > 0 ||
    Number(room.max_pax) !== 1 ||
    Boolean(room.status && room.status !== "Available") ||
    Boolean(room.tenant_name?.trim()) ||
    Boolean(room.tenant_gender?.trim()) ||
    Boolean(room.tenant_race?.trim()) ||
    Number(room.pax_staying) > 0 ||
    Boolean(room.room && room.room !== getDefaultRoomName(index, naming))
  );
};

const emptyUnit = {
  building: "", unit: "", location: "", unit_type: "Mix Unit", unit_max_pax: 6,
  passcode: "", access_card: "", parking_lot: "",
  access_card_source: "Provided by Us", access_card_deposit: 0,
  access_info: "", internal_only: false,
  deposit: "", meter_type: "Postpaid", meter_rate: 0.65,
  deposit_multiplier: 1.5, admin_fee: 330,
  parking_type: "None", parking_card_deposit: 0,
  common_photos: [] as string[], wifi_name: "", wifi_password: "",
};

interface AdminContentProps {
  tab: "dashboard" | "units" | "bookings" | "movein" | "users" | "activity";
}

export function AdminContent({ tab }: AdminContentProps) {
  const { user, role } = useAuth();
  const canViewActivityLog = role === "boss" || role === "manager";
  const canCreateManager = role === "boss";
  const canCreateRoles = role === "boss" ? ["manager", "admin", "agent"] : role === "manager" ? ["admin", "agent"] : ["agent"];


  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionDraft, setCommissionDraft] = useState<{ type: string; config: CommissionConfig }>({ type: "internal_basic", config: defaultConfigs.internal_basic });
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ email: "", name: "", phone: "", address: "", role: "agent" as string, commission_type: "internal_basic" as string, commission_config: defaultConfigs.internal_basic as CommissionConfig });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({ name: "", phone: "", address: "" });

  // Units state
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: condosList = [] } = useCondos();
  const { data: locationsList = [] } = useLocations();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();
  const [editingUnit, setEditingUnit] = useState<typeof emptyUnit & { id?: string } | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>([]);
  const [roomCountInput, setRoomCountInput] = useState("5");
  const [carParkCountInput, setCarParkCountInput] = useState("0");
  const [roomNaming, setRoomNaming] = useState<"alpha" | "digit">("alpha");
  const [editingRoomConfigIndex, setEditingRoomConfigIndex] = useState<number | null>(null);
  const [unitFilters, setUnitFilters] = useState({ location: "All", building: "All", price: "All", unitType: "All" });
  const [showUnitCancelConfirm, setShowUnitCancelConfirm] = useState(false);
  const [showRoomCancelConfirm, setShowRoomCancelConfirm] = useState(false);
  const [roomToRemove, setRoomToRemove] = useState<{ id: string; name: string; status: string } | null>(null);

  // Bookings state
  const { data: allBookings = [] } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");


  useEffect(() => {
    if (user) fetchUsers();
  }, [user]);

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

  const toggleRole = async (userId: string, targetRole: "admin" | "agent" | "boss" | "manager", hasRole: boolean) => {
    setUpdating(userId + targetRole);
    try {
      if (hasRole) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", targetRole);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: targetRole });
        if (error) throw error;
      }
      logActivity(hasRole ? "remove_role" : "add_role", "user", userId, { role: targetRole });
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const createAgent = async () => {
    if (!newAgent.email.trim()) { alert("Email is required"); return; }
    setCreatingAgent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: "create", ...newAgent },
      });
      if (res.error) throw res.error;
      const resData = res.data;
      if (resData?.error) throw new Error(resData.error);
      logActivity("create_user", "user", "", { email: newAgent.email, name: newAgent.name });
      setNewAgent({ email: "", name: "", phone: "", address: "", role: "agent", commission_type: "internal_basic", commission_config: defaultConfigs.internal_basic });
      setShowCreateAgent(false);
      alert("Invite sent! The user will receive an email to set up their password.");
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || "Failed to invite user");
    } finally {
      setCreatingAgent(false);
    }
  };

  const saveProfile = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: "update_profile", user_id: userId, ...profileDraft },
      });
      if (res.error) throw res.error;
      setEditingProfile(null);
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || "Failed to save profile");
    }
  };


  const openCreateRoom2 = () => {
    setEditingUnit({ ...emptyUnit });
    setRoomNaming("alpha");
    setRoomCountInput("5");
    setCarParkCountInput("0");
    setRoomConfigs(createDefaultRoomConfigs(5, 0, "alpha"));
    setEditingRoomConfigIndex(null);
  };

  const rebuildRoomConfigs = (roomCount: number, carParkCount: number, naming: "alpha" | "digit") => {
    const regularRooms = roomConfigs.filter(r => r.room_type !== "Car Park");
    const carParks = roomConfigs.filter(r => r.room_type === "Car Park");

    // Rebuild regular rooms
    let nextRooms = regularRooms.slice(0, roomCount).map((room, index) => ({
      ...room,
      room: getDefaultRoomName(index, naming),
    }));
    while (nextRooms.length < roomCount) {
      nextRooms.push({ room: getDefaultRoomName(nextRooms.length, naming), bed_type: "", max_pax: 1, rent: 0, status: "Available" });
    }

    // Rebuild car parks
    let nextCPs = carParks.slice(0, carParkCount).map((cp, index) => ({
      ...cp,
      room: getDefaultCarParkName(index),
    }));
    while (nextCPs.length < carParkCount) {
      nextCPs.push({ room: getDefaultCarParkName(nextCPs.length), bed_type: "", max_pax: 0, rent: 0, room_type: "Car Park" });
    }

    setRoomConfigs([...nextRooms, ...nextCPs]);
  };

  const handleRoomCountChange = (val: string) => {
    const n = Math.max(1, Math.min(20, Math.floor(Number(val) || 1)));
    setRoomCountInput(String(n));
    rebuildRoomConfigs(n, Number(carParkCountInput) || 0, roomNaming);
  };

  const handleCarParkCountChange = (val: string) => {
    const n = Math.max(0, Math.min(10, Math.floor(Number(val) || 0)));
    setCarParkCountInput(String(n));
    rebuildRoomConfigs(Number(roomCountInput) || 1, n, roomNaming);
  };

  const handleNamingChange = (naming: "alpha" | "digit") => {
    setRoomNaming(naming);
    rebuildRoomConfigs(Number(roomCountInput) || 1, Number(carParkCountInput) || 0, naming);
  };

  const saveUnit = async () => {
    if (!editingUnit) return;

    const missingFields: string[] = [];
    if (!editingUnit.building.trim()) missingFields.push("Condo / Building");
    if (!editingUnit.location.trim()) missingFields.push("Location");
    if (!editingUnit.unit.trim()) missingFields.push("Unit");
    if (!editingUnit.unit_type.trim()) missingFields.push("Unit Type");
    if (!Number.isFinite(Number(editingUnit.unit_max_pax)) || Number(editingUnit.unit_max_pax) < 1) missingFields.push("Max Occupants");
    if (!Number.isFinite(Number(editingUnit.deposit_multiplier)) || Number(editingUnit.deposit_multiplier) <= 0) missingFields.push("Rental Deposit (months)");
    if (!editingUnit.meter_type.trim()) missingFields.push("Meter Type");
    if (!Number.isFinite(Number(editingUnit.meter_rate)) || Number(editingUnit.meter_rate) < 0) missingFields.push("Meter Rate");
    if (!Number.isFinite(Number(editingUnit.admin_fee)) || Number(editingUnit.admin_fee) < 0) missingFields.push("Admin Fee");

    if (!editingUnit.id) {
      const regularRooms = roomConfigs.filter(room => room.room_type !== "Car Park");
      const carParks = roomConfigs.filter(room => room.room_type === "Car Park");

      if (regularRooms.length < 1) missingFields.push("Number of Rooms");

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
    }

    if (missingFields.length > 0) {
      alert(`Please complete the required fields:\n• ${missingFields.join("\n• ")}`);
      return;
    }

    try {
      if (editingUnit.id) {
        await updateUnit.mutateAsync({ id: editingUnit.id, ...editingUnit });
        logActivity("update_unit", "unit", editingUnit.id, { building: editingUnit.building, unit: editingUnit.unit });
      } else {
        await createUnit.mutateAsync({ unit: editingUnit, roomConfigs });
        logActivity("create_unit", "unit", "", { building: editingUnit.building, unit: editingUnit.unit });
      }
      setEditingUnit(null);
    } catch (e: any) {
      alert(e.message || "Failed to save unit");
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm("Delete this unit and all its rooms?")) return;
    try {
      await deleteUnit.mutateAsync(id);
      logActivity("delete_unit", "unit", id, {});
    } catch (e: any) { alert(e.message); }
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

  const changeRoomStatus = async (room: Room, newStatus: string) => {
    try {
      const updates: any = { id: room.id, status: newStatus };
      if (newStatus === "Available") {
        updates.available_date = "Available Now";
      }
      await updateRoom.mutateAsync(updates);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const changeRoomAvailableDate = async (room: Room, date: string) => {
    try {
      await updateRoom.mutateAsync({ id: room.id, available_date: date });
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (fetching && tab === "users") {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  // Helper functions for dialog close with confirmation
  const handleUnitClose = () => {
    if (editingUnit && (editingUnit.building || editingUnit.unit)) {
      setShowUnitCancelConfirm(true);
    } else {
      setEditingUnit(null);
    }
  };

  const handleRoomClose = () => {
    setShowRoomCancelConfirm(true);
  };

  // ─── ROOM EDIT DIALOG CONTENT ───
  const renderRoomEditDialog = () => {
    if (!editingRoom) return null;
    const r = editingRoom;
    const isCarPark = r.room_type === "Car Park";
    const updateFieldR = (field: string, value: any) => setEditingRoom({ ...r, [field]: value });
    const updateCost = (field: string, value: number) => setEditingRoom({ ...r, move_in_cost: { ...r.move_in_cost, [field]: value } });

    return (
      <div className="space-y-5 pb-4">
        <div className="text-muted-foreground text-sm">{r.building} · {r.unit}</div>

        {/* Room Photos — top, optional */}
        {!isCarPark && (
        <>
        <div className="text-lg font-semibold">Room Photos <span className="text-xs font-normal text-muted-foreground">(optional)</span></div>
        <div className="grid grid-cols-3 gap-3">
          {(r.photos as string[] || []).map((url: string, i: number) => (
            <div key={i} className="relative group">
              <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${url}`} alt={`Photo ${i + 1}`} className="h-32 w-full object-cover rounded-lg" />
              <button onClick={async () => {
                const newPhotos = (r.photos as string[]).filter((_, idx) => idx !== i);
                updateFieldR("photos", newPhotos);
                try { await updateRoom.mutateAsync({ id: r.id, photos: newPhotos } as any); } catch (err: any) { alert(err.message); }
              }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>
          ))}
          {(r.photos as string[] || []).length < 10 && (
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
                updateFieldR("photos", updatedPhotos);
                try { await updateRoom.mutateAsync({ id: r.id, photos: updatedPhotos } as any); } catch (err: any) { alert(err.message); }
              }
              e.target.value = "";
            }} />
          </label>
          )}
        </div>
        </>
        )}

        {isCarPark ? (() => {
          const sameBuildingTenants = units
            .filter(u => u.building === r.building)
            .flatMap(u => (u.rooms || []).filter(rm => rm.room_type !== "Car Park" && rm.status === "Occupied" && rm.tenant_gender))
            .map(rm => `${rm.unit} ${rm.room} — ${rm.tenant_gender}`);
          return (
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-xs text-muted-foreground">Parking Lot</label><input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={r.bed_type || ""} onChange={e => updateFieldR("bed_type", e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Rental (RM)</label><input className={`${inputClass} w-full`} type="number" value={r.rent} onChange={e => updateFieldR("rent", Number(e.target.value))} /></div>
            <div><label className="text-xs text-muted-foreground">Status</label>
              <select className={`${inputClass} w-full`} value={r.status} onChange={e => updateFieldR("status", e.target.value)}>
                <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Rented to (Tenant from same building)</label>
              <select className={`${inputClass} w-full`} value={r.tenant_gender || ""} onChange={e => updateFieldR("tenant_gender", e.target.value)}>
                <option value="">— None —</option>
                {sameBuildingTenants.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className={`${inputClass} w-full mt-2`} placeholder="Or type manually (e.g. name / plate)" value={r.tenant_gender || ""} onChange={e => updateFieldR("tenant_gender", e.target.value)} />
            </div>
          </div>
          );
        })() : (
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="text-xs text-muted-foreground">Bed Type</label>
            <select className={`${inputClass} w-full`} value={r.bed_type || ""} onChange={e => { const bt = e.target.value; setEditingRoom({ ...r, bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 }); }}>
              <option value="">—</option>
              <option value="Single">Single</option>
              <option value="Super Single">Super Single</option>
              <option value="Queen">Queen</option>
              <option value="King">King</option>
            </select>
          </div>
          <div><label className="text-xs text-muted-foreground">Rental (RM)</label><input className={`${inputClass} w-full`} type="number" value={r.rent} onChange={e => updateFieldR("rent", Number(e.target.value))} /></div>
          <div><label className="text-xs text-muted-foreground">Wall Type</label>
            <select className={`${inputClass} w-full`} value={(r as any).wall_type || ""} onChange={e => updateFieldR("wall_type", e.target.value)}>
              <option value="">—</option>
              <option value="Partition">Partition</option>
              <option value="Original">Original</option>
            </select>
          </div>
          <div><label className="text-xs text-muted-foreground">Special Type <span className="text-muted-foreground/60">(optional)</span></label>
            <select className={`${inputClass} w-full`} value={(r as any).special_type || ""} onChange={e => updateFieldR("special_type", e.target.value)}>
              <option value="">— None —</option>
              <option value="Balcony">Balcony</option>
              <option value="Master">Master</option>
            </select>
          </div>
          <div><label className="text-xs text-muted-foreground">Status</label>
            <select className={`${inputClass} w-full`} value={r.status} onChange={e => updateFieldR("status", e.target.value)}>
              <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
            </select>
          </div>
          <div><label className="text-xs text-muted-foreground">Max Pax</label><input className={`${inputClass} w-full`} type="number" value={r.max_pax} onChange={e => updateFieldR("max_pax", Number(e.target.value))} /></div>
          <div><label className="text-xs text-muted-foreground">Available Date</label>
            <input className={`${inputClass} w-full`} type="date" value={r.available_date === "Available Now" ? "" : r.available_date} onChange={e => updateFieldR("available_date", e.target.value || "Available Now")} />
            <span className="text-xs text-muted-foreground">Leave empty for "Available Now"</span>
          </div>
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
      </div>
    );
  };

  // ─── UNIT FORM DIALOG CONTENT ───
  const renderUnitFormDialog = () => {
    if (!editingUnit) return null;
    const u = editingUnit;
    const updateFieldU = (field: string, value: any) => setEditingUnit({ ...u, [field]: value });

    return (
      <div className="space-y-5 pb-4">
        {/* Common Area Photos */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Common Area Photos *</label>
          <div className="flex flex-wrap gap-3 mt-2">
            {((u as any).common_photos as string[] || []).map((path: string, i: number) => (
              <div key={i} className="relative group">
                <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-20 w-20 object-cover rounded-lg" />
                <button onClick={() => {
                  const newPhotos = ((u as any).common_photos as string[] || []).filter((_: string, idx: number) => idx !== i);
                  setEditingUnit({ ...u, common_photos: newPhotos });
                }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
            {((u as any).common_photos || []).length < 10 && (
              <label className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <span className="text-xl text-muted-foreground">+</span>
                <span className="text-[10px] text-muted-foreground">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  const existing = ((u as any).common_photos as string[] || []);
                  const remaining = 10 - existing.length;
                  const toUpload = files.slice(0, remaining);
                  const newPaths: string[] = [];
                  for (const file of toUpload) {
                    const ext = file.name.split('.').pop();
                    const path = `common/temp_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                    if (error) { alert(`Upload failed: ${error.message}`); continue; }
                    newPaths.push(path);
                  }
                  if (newPaths.length > 0) {
                    setEditingUnit({ ...u, common_photos: [...existing, ...newPaths] });
                  }
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Condo / Building *</label>
            <select className={`${inputClass} w-full`} value={u.building} onChange={e => {
              const selectedCondo = condosList.find(c => c.name === e.target.value);
              const locationName = selectedCondo?.location?.name || "";
              setEditingUnit({ ...u, building: e.target.value, location: locationName });
            }}>
              <option value="">— Select Condo —</option>
              {condosList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Location (auto-filled from condo) *</label>
            <input className={`${inputClass} w-full bg-muted`} value={u.location} readOnly placeholder="Select a condo above" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Unit (e.g. A-17-8) *</label>
            <input className={`${inputClass} w-full`} placeholder="Unit" value={u.unit} onChange={e => updateFieldU("unit", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Unit Type *</label>
            <select className={`${inputClass} w-full`} value={u.unit_type} onChange={e => updateFieldU("unit_type", e.target.value)}>
              <option>Mix Unit</option><option>Female Unit</option><option>Male Unit</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Occupants *</label>
            <input className={`${inputClass} w-full`} type="number" placeholder="Maximum Pax" value={u.unit_max_pax} onChange={e => updateFieldU("unit_max_pax", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rental Deposit (months) *</label>
            <input className={`${inputClass} w-full`} type="number" step="0.1" placeholder="e.g. 1.5 months" value={u.deposit_multiplier} onChange={e => updateFieldU("deposit_multiplier", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Meter Type *</label>
            <select className={`${inputClass} w-full`} value={u.meter_type} onChange={e => updateFieldU("meter_type", e.target.value)}>
              <option value="Postpaid">Postpaid</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Meter Rate (RM/kWh) *</label>
            <input className={`${inputClass} w-full`} type="number" step="0.01" placeholder="Meter Rate" value={u.meter_rate || ""} onChange={e => updateFieldU("meter_rate", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Admin Fee (RM) *</label>
            <input className={`${inputClass} w-full`} type="number" placeholder="Admin Fee" value={u.admin_fee} onChange={e => updateFieldU("admin_fee", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Maintenance Passcode (optional)</label>
            <input className={`${inputClass} w-full`} placeholder="Passcode" value={u.passcode} onChange={e => updateFieldU("passcode", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">WiFi Name (optional)</label>
            <input className={`${inputClass} w-full`} placeholder="WiFi SSID" value={(u as any).wifi_name || ""} onChange={e => updateFieldU("wifi_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">WiFi Password (optional)</label>
            <input className={`${inputClass} w-full`} placeholder="WiFi Password" value={(u as any).wifi_password || ""} onChange={e => updateFieldU("wifi_password", e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <input type="checkbox" id="internalOnly" checked={u.internal_only} onChange={e => updateFieldU("internal_only", e.target.checked)} className="w-4 h-4 rounded" />
          <label htmlFor="internalOnly" className="text-sm font-medium">🔒 Internal Only (hidden from external agents)</label>
        </div>

        {/* Room Configs (only for new units) */}
        {!u.id && (
          <>
            <div className="pt-4 border-t border-border space-y-4">
              <div className="text-lg font-semibold">Rooms & Car Parks</div>

              {/* Count selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Number of Rooms *</label>
                  <input className={`${inputClass} w-full`} type="number" min={1} max={20} value={roomCountInput}
                    onChange={e => { setRoomCountInput(e.target.value); }}
                    onBlur={() => handleRoomCountChange(roomCountInput)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleRoomCountChange(roomCountInput); } }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Number of Car Parks</label>
                  <input className={`${inputClass} w-full`} type="number" min={0} max={10} value={carParkCountInput}
                    onChange={e => { setCarParkCountInput(e.target.value); }}
                    onBlur={() => handleCarParkCountChange(carParkCountInput)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCarParkCountChange(carParkCountInput); } }}
                  />
                </div>
              </div>

              {/* Naming convention radio */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Room Naming Convention</label>
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

              {/* Room/CarPark cards with inline editing */}
              <div className="space-y-3">
                {roomConfigs.map((rc, i) => {
                  const isCP = rc.room_type === "Car Park";
                  const updateRC = (field: string, value: any) => {
                    const c = [...roomConfigs];
                    c[i] = { ...c[i], [field]: value };
                    setRoomConfigs(c);
                  };
                  return (
                    <div key={i} className={`rounded-lg border p-4 space-y-3 ${isCP ? "bg-sky-500/5 border-sky-500/20" : "bg-card"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{isCP ? `🅿️ ${rc.room}` : rc.room}</span>
                        <button
                          onClick={() => setEditingRoomConfigIndex(i)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          More Details
                        </button>
                      </div>
                      {isCP ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Parking Lot *</label>
                            <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={rc.bed_type || ""} onChange={e => updateRC("bed_type", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Rental (RM)</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => updateRC("rent", Number(e.target.value))} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
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
                            <label className="text-xs text-muted-foreground">Status</label>
                            <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => updateRC("status", e.target.value)}>
                              <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* More Details dialog for room config */}
            <Dialog open={editingRoomConfigIndex !== null} onOpenChange={(open) => { if (!open) setEditingRoomConfigIndex(null); }}>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>{editingRoomConfigIndex !== null ? roomConfigs[editingRoomConfigIndex]?.room : ""} — More Details</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
                {editingRoomConfigIndex !== null && (() => {
                  const idx = editingRoomConfigIndex;
                  const rc = roomConfigs[idx];
                  if (!rc) return null;
                  const isCP = rc.room_type === "Car Park";
                  const updateRC = (field: string, value: any) => {
                    const c = [...roomConfigs];
                    c[idx] = { ...c[idx], [field]: value };
                    setRoomConfigs(c);
                  };

                  return (
                    <div className="space-y-5 pb-4">
                      {/* Room Photos placeholder (new unit — no upload yet, just info) */}
                      {!isCP && (
                        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                          📷 Room photos can be uploaded after the unit is created.
                        </div>
                      )}

                      {isCP ? (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div><label className="text-xs text-muted-foreground">Parking Lot</label>
                            <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={rc.bed_type || ""} onChange={e => updateRC("bed_type", e.target.value)} /></div>
                          <div><label className="text-xs text-muted-foreground">Rental (RM)</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => updateRC("rent", Number(e.target.value))} /></div>
                          <div><label className="text-xs text-muted-foreground">Status</label>
                            <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => updateRC("status", e.target.value)}>
                              <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                            </select></div>
                        </div>
                      ) : (
                        <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div><label className="text-xs text-muted-foreground">Bed Type</label>
                            <select className={`${inputClass} w-full`} value={rc.bed_type} onChange={e => {
                              const bt = e.target.value;
                              const c = [...roomConfigs];
                              c[idx] = { ...c[idx], bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 };
                              setRoomConfigs(c);
                            }}>
                              <option value="">—</option><option value="Single">Single</option><option value="Super Single">Super Single</option><option value="Queen">Queen</option><option value="King">King</option>
                            </select></div>
                          <div><label className="text-xs text-muted-foreground">Rental (RM)</label>
                            <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => updateRC("rent", Number(e.target.value))} /></div>
                          <div><label className="text-xs text-muted-foreground">Wall Type</label>
                            <select className={`${inputClass} w-full`} value={(rc as any).wall_type || ""} onChange={e => updateRC("wall_type", e.target.value)}>
                              <option value="">—</option><option value="Partition">Partition</option><option value="Original">Original</option>
                            </select></div>
                          <div><label className="text-xs text-muted-foreground">Special Type <span className="text-muted-foreground/60">(optional)</span></label>
                            <select className={`${inputClass} w-full`} value={(rc as any).special_type || ""} onChange={e => updateRC("special_type", e.target.value)}>
                              <option value="">— None —</option><option value="Balcony">Balcony</option><option value="Master">Master</option>
                            </select></div>
                          <div><label className="text-xs text-muted-foreground">Max Pax</label>
                            <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => updateRC("max_pax", Number(e.target.value))} /></div>
                          <div><label className="text-xs text-muted-foreground">Status</label>
                            <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => updateRC("status", e.target.value)}>
                              <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                            </select></div>
                          <div><label className="text-xs text-muted-foreground">Available Date</label>
                            <input className={`${inputClass} w-full`} type="date" value={(rc as any).available_date && (rc as any).available_date !== "Available Now" ? (rc as any).available_date : ""} onChange={e => updateRC("available_date", e.target.value || "Available Now")} />
                            <span className="text-xs text-muted-foreground">Leave empty for "Available Now"</span></div>
                        </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                </div>
                <DialogFooter>
                  <button onClick={() => setEditingRoomConfigIndex(null)} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Done</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Rooms list for existing units */}
        {u.id && (() => {
          const existingRooms = units.find(un => un.id === u.id)?.rooms || [];
          const regularRooms = existingRooms.filter(r => r.room_type !== "Car Park");
          const carParkRooms = existingRooms.filter(r => r.room_type === "Car Park");
          const detectedNaming: "alpha" | "digit" = regularRooms.length > 0 && /^Room [A-Z]/.test(regularRooms[0]?.room || "") ? "alpha" : "digit";

          const handleEditRoomCount = async (newCount: number) => {
            const current = regularRooms.length;
            if (newCount === current || newCount < 1 || newCount > 20) return;
            const naming = detectedNaming;
            if (newCount > current) {
              for (let i = current; i < newCount; i++) {
                await createRoom.mutateAsync({
                  unit_id: u.id,
                  building: u.building,
                  location: u.location,
                  unit: u.unit,
                  room: getDefaultRoomName(i, naming),
                  bed_type: "",
                  max_pax: 1,
                  rent: 0,
                  status: "Available",
                });
              }
            } else {
              const toRemove = regularRooms.slice(newCount);
              for (const room of toRemove) {
                await deleteRoom.mutateAsync(room.id);
              }
            }
          };

          const handleEditCarParkCount = async (newCount: number) => {
            const current = carParkRooms.length;
            if (newCount === current || newCount < 0 || newCount > 10) return;
            if (newCount > current) {
              for (let i = current; i < newCount; i++) {
                await createRoom.mutateAsync({
                  unit_id: u.id,
                  building: u.building,
                  location: u.location,
                  unit: u.unit,
                  room: getDefaultCarParkName(i),
                  room_type: "Car Park",
                  bed_type: "",
                  max_pax: 0,
                  rent: 0,
                  status: "Available",
                });
              }
            } else {
              const toRemove = carParkRooms.slice(newCount);
              for (const cp of toRemove) {
                await deleteRoom.mutateAsync(cp.id);
              }
            }
          };

          const handleEditNaming = async (naming: "alpha" | "digit") => {
            for (let i = 0; i < regularRooms.length; i++) {
              const newName = getDefaultRoomName(i, naming);
              if (regularRooms[i].room !== newName) {
                await updateRoom.mutateAsync({ id: regularRooms[i].id, room: newName });
              }
            }
          };

          return (
          <div className="pt-4 border-t border-border space-y-4">
            <div className="text-lg font-semibold">Rooms & Car Parks</div>

            {/* Count & naming controls */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Number of Rooms *</label>
                <input className={`${inputClass} w-full`} type="number" min={1} max={20} defaultValue={regularRooms.length}
                  onBlur={e => handleEditRoomCount(Math.floor(Number(e.target.value) || 1))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Number of Car Parks</label>
                <input className={`${inputClass} w-full`} type="number" min={0} max={10} defaultValue={carParkRooms.length}
                  onBlur={e => handleEditCarParkCount(Math.floor(Number(e.target.value) || 0))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
              </div>
            </div>

            {/* Naming convention radio */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Room Naming Convention</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="editRoomNaming" value="alpha" checked={detectedNaming === "alpha"} onChange={() => handleEditNaming("alpha")} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">Alphabet (Room A, B, C…)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="editRoomNaming" value="digit" checked={detectedNaming === "digit"} onChange={() => handleEditNaming("digit")} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">Digit (Room 1, 2, 3…)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              {(units.find(un => un.id === u.id)?.rooms || []).map((room) => {
                const isCP = room.room_type === "Car Park";
                return (
                  <div key={room.id} className={`rounded-lg border p-4 space-y-3 ${isCP ? "bg-sky-500/5 border-sky-500/20" : "bg-card"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{isCP ? `🅿️ ${room.room}` : room.room}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setRoomToRemove({ id: room.id, name: room.room, status: room.status })} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors shrink-0">
                          Remove
                        </button>
                        <button onClick={() => setEditingRoom(room)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors shrink-0">
                          More Details
                        </button>
                      </div>
                    </div>
                    {isCP ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Parking Lot *</label>
                          <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={room.bed_type || ""} onChange={async e => { try { await updateRoom.mutateAsync({ id: room.id, bed_type: e.target.value }); } catch {} }} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rental (RM)</label>
                          <input className={`${inputClass} w-full`} type="number" value={room.rent} onChange={async e => { try { await updateRoom.mutateAsync({ id: room.id, rent: Number(e.target.value) }); } catch {} }} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Bed Type *</label>
                          <select className={`${inputClass} w-full`} value={room.bed_type || ""} onChange={async e => {
                            const bt = e.target.value;
                            try { await updateRoom.mutateAsync({ id: room.id, bed_type: bt, max_pax: bedTypeMaxPax[bt] || 1 }); } catch {}
                          }}>
                            <option value="">—</option><option value="Single">Single</option><option value="Super Single">Super Single</option><option value="Queen">Queen</option><option value="King">King</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rental (RM) *</label>
                          <input className={`${inputClass} w-full`} type="number" value={room.rent} onChange={async e => { try { await updateRoom.mutateAsync({ id: room.id, rent: Number(e.target.value) }); } catch {} }} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Max Pax *</label>
                          <input className={`${inputClass} w-full`} type="number" min={1} value={room.max_pax} onChange={async e => { try { await updateRoom.mutateAsync({ id: room.id, max_pax: Number(e.target.value) }); } catch {} }} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Status</label>
                          <select className={`${inputClass} w-full`} value={room.status} onChange={async e => {
                            const updates: any = { id: room.id, status: e.target.value };
                            if (e.target.value === "Available") updates.available_date = "Available Now";
                            try { await updateRoom.mutateAsync(updates); } catch {}
                          }}>
                            <option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Pending">Pending</option><option value="Occupied">Occupied</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>}

      {/* Room Edit Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => { if (!open) handleRoomClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit {editingRoom?.room_type === "Car Park" ? `🅿️ ${editingRoom?.room}` : editingRoom?.room}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
            {renderRoomEditDialog()}
          </div>
          <DialogFooter>
            <button onClick={handleRoomClose} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
            <button onClick={saveRoom} disabled={updateRoom.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {updateRoom.isPending ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Add/Edit Dialog */}
      <Dialog open={!!editingUnit} onOpenChange={(open) => { if (!open) handleUnitClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingUnit?.id ? "Edit Unit" : "Add Unit and Rooms"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
            {renderUnitFormDialog()}
          </div>
          <DialogFooter>
            <button onClick={handleUnitClose} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
            <button onClick={saveUnit} disabled={createUnit.isPending || updateUnit.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {(createUnit.isPending || updateUnit.isPending) ? "Saving..." : editingUnit?.id ? "Save Changes" : "Save Unit and Rooms"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation for Unit */}
      <AlertDialog open={showUnitCancelConfirm} onOpenChange={setShowUnitCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel? Your unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditingUnit(null); setShowUnitCancelConfirm(false); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation for Room */}
      <AlertDialog open={showRoomCancelConfirm} onOpenChange={setShowRoomCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel? Your unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditingRoom(null); setShowRoomCancelConfirm(false); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Room Confirmation */}
      <AlertDialog open={!!roomToRemove} onOpenChange={(open) => { if (!open) setRoomToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {roomToRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {roomToRemove && ["Occupied", "Available Soon", "Pending"].includes(roomToRemove.status)
                ? `This room cannot be removed because its status is "${roomToRemove.status}". Only rooms with "Available" status can be removed.`
                : `Are you sure you want to permanently remove "${roomToRemove?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {roomToRemove && !["Occupied", "Available Soon", "Pending"].includes(roomToRemove.status) && (
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                try { await deleteRoom.mutateAsync(roomToRemove.id); } catch {}
                setRoomToRemove(null);
              }}>Remove</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            logActivity("approve_booking", "booking", booking.id, { tenant: booking.tenant_name });
            setSelectedBooking(null);
          } catch (e: any) { alert(e.message); }
        };

        const handleReject = async (booking: Booking) => {
          if (!user || !rejectReason.trim()) { alert("Please enter a reject reason"); return; }
          try {
            await updateBookingStatus.mutateAsync({ id: booking.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason, carParkIds: ((booking as any).documents as any)?.carParkIds || [] });
            logActivity("reject_booking", "booking", booking.id, { tenant: booking.tenant_name, reason: rejectReason });
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
      {tab === "units" && <UnitsRoomsContent
        onEditUnit={setEditingUnit}
      />}

      {/* BOOKINGS TAB */}
      {tab === "bookings" && <BookingsContent />}

      {/* MOVE IN TAB */}
      {tab === "movein" && <MoveInPage />}

      {/* USERS TAB */}
      {tab === "users" && <UsersPage />}

      {tab === "activity" && canViewActivityLog && <ActivityLogPage />}
    </div>
  );
}

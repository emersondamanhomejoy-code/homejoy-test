import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Unit {
  id: string;
  building: string;
  unit: string;
  location: string;
  unit_type: string;
  unit_max_pax: number;
  passcode: string;
  access_card: string;
  access_card_source: string;
  access_card_deposit: number;
  parking_lot: string;
  access_info: string;
  internal_only: boolean;
  common_photos: string[];
  deposit_multiplier: number;
  admin_fee: number;
  created_at: string;
  updated_at: string;
  rooms?: Room[];
}

export interface Room {
  id: string;
  unit_id: string | null;
  building: string;
  unit: string;
  room: string;
  location: string;
  rent: number;
  room_type: string;
  unit_type: string;
  status: string;
  available_date: string;
  max_pax: number;
  occupied_pax: number;
  unit_max_pax: number;
  unit_occupied_pax: number;
  housemates: string[];
  photos: string[];
  access_info: string;
  move_in_cost: {
    advance: number;
    deposit: number;
    accessCard: number;
    moveInFee: number;
    total: number;
  };
  bed_type: string;
  pax_staying: number;
  tenant_gender: string;
  tenant_race: string;
  internal_only: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Units ───

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data: units, error: uErr } = await supabase
        .from("units")
        .select("*")
        .order("created_at", { ascending: false });
      if (uErr) throw uErr;

      const { data: rooms, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .order("room", { ascending: true });
      if (rErr) throw rErr;

      return (units as unknown as Unit[]).map((u) => ({
        ...u,
        rooms: (rooms as unknown as Room[]).filter((r) => r.unit_id === u.id),
      }));
    },
  });
}

export interface RoomConfig {
  room: string;
  bed_type: string;
  max_pax: number;
  rent: number;
  room_type?: string;
  parking_lot?: string;
  status?: string;
  tenant_name?: string;
  tenant_gender?: string;
  tenant_race?: string;
  pax_staying?: number;
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      unit: { building: string; unit: string; location: string; unit_type: string; unit_max_pax: number; passcode?: string; access_card?: string; parking_lot?: string; access_info: any; internal_only?: boolean };
      roomConfigs: RoomConfig[];
    }) => {
      const { unit, roomConfigs } = payload;
      const { rooms: _r, ...cleanUnit } = unit as any;
      const { data: newUnit, error: uErr } = await supabase
        .from("units")
        .insert(cleanUnit)
        .select()
        .single();
      if (uErr) throw uErr;

      const rooms = roomConfigs.map((rc) => ({
        unit_id: (newUnit as any).id,
        building: unit.building,
        unit: unit.unit,
        room: rc.room,
        location: unit.location,
        rent: rc.rent,
        bed_type: rc.room_type === "Car Park" ? "" : (rc.bed_type || ""),
        room_type: rc.room_type === "Car Park" ? "Car Park" : (rc.bed_type || "Medium Room"),
        unit_type: unit.unit_type,
        status: rc.status || "Available",
        available_date: "Available Now",
        max_pax: rc.room_type === "Car Park" ? 0 : rc.max_pax,
        occupied_pax: rc.status === "Occupied" ? (rc.pax_staying || 1) : 0,
        pax_staying: rc.status === "Occupied" ? (rc.pax_staying || 1) : 0,
        unit_max_pax: unit.unit_max_pax,
        unit_occupied_pax: 0,
        housemates: rc.status === "Occupied" && rc.tenant_name ? [rc.tenant_name] : [],
        photos: [],
        access_info: unit.access_info,
        move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
        tenant_gender: rc.status === "Occupied" ? (rc.tenant_gender || "") : "",
        tenant_race: rc.status === "Occupied" ? (rc.tenant_race || "") : "",
        internal_only: unit.internal_only || false,
      }));
      const { error: rErr } = await supabase.from("rooms").insert(rooms);
      if (rErr) throw rErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Unit> & { id: string }) => {
      const { rooms: _r2, ...cleanRest } = rest as any;
      const { error } = await supabase.from("units").update(cleanRest).eq("id", id);
      if (error) throw error;
      // Sync internal_only to rooms
      if (rest.internal_only !== undefined) {
        await supabase.from("rooms").update({ internal_only: rest.internal_only } as any).eq("unit_id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });
}

// ─── Rooms ───

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Room[];
    },
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Room> & { id: string }) => {
      const { created_at, updated_at, ...fields } = rest as any;
      const { error } = await supabase.from("rooms").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (room: Record<string, any>) => {
      const { error } = await supabase.from("rooms").insert(room as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

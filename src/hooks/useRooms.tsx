import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Room {
  id: string;
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
  access_info: {
    condoEntry: string;
    unitAccess: string;
    visitorParking: string;
    viewing: string;
  };
  move_in_cost: {
    advance: number;
    deposit: number;
    accessCard: number;
    moveInFee: number;
    total: number;
  };
  created_at: string;
  updated_at: string;
}

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

export function useUpsertRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (room: Partial<Room> & { id?: string }) => {
      const { id, created_at, updated_at, ...rest } = room as any;
      if (id) {
        const { error } = await supabase.from("rooms").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rooms").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Condo {
  id: string;
  name: string;
  address: string;
  description: string;
  gps_link: string;
  photos: string[];
  deposit_info: string;
  parking_info: string;
  amenities: string;
  location_id: string | null;
  access_items: any[];
  visitor_car_parking: string;
  visitor_motorcycle_parking: string;
  arrival_instruction: string;
  created_at: string;
  updated_at: string;
  location?: { id: string; name: string } | null;
}

export function useCondos() {
  return useQuery({
    queryKey: ["condos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condos")
        .select("*, location:locations(id, name)")
        .order("name");
      if (error) throw error;
      return (data as any[]).map(d => ({
        ...d,
        photos: Array.isArray(d.photos) ? d.photos : [],
      })) as Condo[];
    },
  });
}

export interface CondoInput {
  name: string;
  address: string;
  description: string;
  gps_link: string;
  photos: string[];
  deposit_info: string;
  parking_info: string;
  amenities: string;
  location_id: string | null;
}

export function useCreateCondo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CondoInput) => {
      const { data, error } = await supabase.from("condos").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["condos"] }),
  });
}

export function useUpdateCondo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CondoInput & { id: string }) => {
      const { error } = await supabase.from("condos").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["condos"] }),
  });
}

export function useDeleteCondo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("condos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["condos"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Booking {
  id: string;
  room_id: string | null;
  unit_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  tenant_ic_passport: string;
  tenant_gender: string;
  tenant_race: string;
  tenant_nationality: string;
  move_in_date: string;
  contract_months: number;
  company: string;
  position: string;
  monthly_salary: number;
  occupation: string;
  pax_staying: number;
  access_card_count: number;
  emergency_name: string;
  emergency_phone: string;
  emergency_relationship: string;
  emergency_contact_2: string;
  parking: string;
  car_plate: string;
  documents: Record<string, any>;
  doc_passport: string[];
  doc_offer_letter: string[];
  doc_transfer_slip: string[];
  submitted_by: string | null;
  submitted_by_type: "agent" | "customer";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string;
  move_in_cost: Record<string, number>;
  created_at: string;
  updated_at: string;
  // joined
  room?: { room: string; building: string; unit: string };
}

export function useBookings(statusFilter?: string) {
  return useQuery({
    queryKey: ["bookings", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, room:rooms(room, building, unit)")
        .order("created_at", { ascending: false });
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Booking[];
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewed_by,
      reject_reason,
      room_id,
      tenant_name,
      tenant_gender,
      tenant_race,
      pax_staying,
      carParkIds,
    }: {
      id: string;
      status: "approved" | "rejected" | "cancelled";
      reviewed_by: string;
      reject_reason?: string;
      room_id?: string | null;
      tenant_name?: string;
      tenant_gender?: string;
      tenant_race?: string;
      pax_staying?: number;
      carParkIds?: string[];
    }) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          status,
          reviewed_by,
          reviewed_at: new Date().toISOString(),
          reject_reason: reject_reason || "",
        })
        .eq("id", id);
      if (error) throw error;

      // On approve: update room status + tenant info
      if (status === "approved" && room_id) {
        const { error: roomErr } = await supabase
          .from("rooms")
          .update({
            status: "Occupied",
            tenant_gender: tenant_gender || "",
            tenant_race: tenant_race || "",
            pax_staying: pax_staying || 1,
            occupied_pax: pax_staying || 1,
          })
          .eq("id", room_id);
        if (roomErr) throw roomErr;

        // Mark selected car parks as Tenanted
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            await supabase.from("rooms").update({
              status: "Tenanted",
              tenant_gender: `${tenant_name || ""} (${tenant_gender || ""})`,
            }).eq("id", cpId);
          }
        }
      }

      // On reject: release reserved car parks
      if (status === "rejected" && carParkIds && carParkIds.length > 0) {
        for (const cpId of carParkIds) {
          await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", cpId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

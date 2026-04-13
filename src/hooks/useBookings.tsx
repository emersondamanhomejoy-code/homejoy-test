import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BookingType = "room_only" | "room_carpark" | "carpark_only";

export interface Booking {
  id: string;
  room_id: string | null;
  unit_id: string | null;
  booking_type: BookingType;
  status: "submitted" | "approved" | "rejected" | "cancelled";
  resolution_type: string;
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
  emergency_1_name: string;
  emergency_1_phone: string;
  emergency_1_relationship: string;
  emergency_2_name: string;
  emergency_2_phone: string;
  emergency_2_relationship: string;
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
  history: any[];
  created_at: string;
  updated_at: string;
  // joined
  room?: { room: string; building: string; unit: string };
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  room_only: "Room Only",
  room_carpark: "Room + Carpark",
  carpark_only: "Carpark Only",
};

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
      tenant_nationality,
      pax_staying,
      carParkIds,
      history,
      resolution_type,
      booking_type,
      bookingData,
    }: {
      id: string;
      status: "approved" | "rejected" | "cancelled";
      reviewed_by: string;
      reject_reason?: string;
      room_id?: string | null;
      tenant_name?: string;
      tenant_gender?: string;
      tenant_race?: string;
      tenant_nationality?: string;
      pax_staying?: number;
      carParkIds?: string[];
      history?: any[];
      resolution_type?: string;
      booking_type?: BookingType;
      bookingData?: Booking;
    }) => {
      const updates: Record<string, any> = {
        status,
        reviewed_by,
        reviewed_at: new Date().toISOString(),
        reject_reason: reject_reason || "",
      };
      if (history !== undefined) updates.history = history;
      if (resolution_type !== undefined) updates.resolution_type = resolution_type;
      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // ─── APPROVE: set room/carpark to Pending, create move-in, create tenant ───
      if (status === "approved") {
        // Set room to Pending (NOT Occupied — that happens on move-in approval)
        if (room_id) {
          await supabase.from("rooms").update({ status: "Pending" }).eq("id", room_id);
        }

        // Set selected car parks to Pending
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            await supabase.from("rooms").update({
              status: "Pending",
              tenant_gender: `${tenant_name || ""} (${tenant_gender || ""})`,
            }).eq("id", cpId);
          }
        }

        // Auto-create move-in record with ready_for_move_in status
        const agentId = bookingData?.submitted_by || reviewed_by;
        await supabase.from("move_ins").insert({
          booking_id: id,
          room_id: room_id || null,
          agent_id: agentId,
          tenant_name: tenant_name || "",
          status: "ready_for_move_in",
          history: [{ action: "created_from_booking_approval", by: reviewed_by, at: new Date().toISOString() }],
        });

        // Create formal tenant record
        if (bookingData) {
          // Check if tenant already exists by phone + name
          const { data: existingTenant } = await supabase
            .from("tenants")
            .select("id")
            .eq("phone", bookingData.tenant_phone)
            .eq("name", bookingData.tenant_name)
            .maybeSingle();

          let tenantId: string;
          if (existingTenant) {
            tenantId = existingTenant.id;
            // Update existing tenant with latest info
            await supabase.from("tenants").update({
              email: bookingData.tenant_email || "",
              ic_passport: bookingData.tenant_ic_passport || "",
              gender: bookingData.tenant_gender || "",
              nationality: bookingData.tenant_nationality || "",
              occupation: bookingData.occupation || "",
              emergency_1_name: bookingData.emergency_1_name || "",
              emergency_1_phone: bookingData.emergency_1_phone || "",
              emergency_1_relationship: bookingData.emergency_1_relationship || "",
              emergency_2_name: bookingData.emergency_2_name || "",
              emergency_2_phone: bookingData.emergency_2_phone || "",
              emergency_2_relationship: bookingData.emergency_2_relationship || "",
              doc_passport: bookingData.doc_passport || [],
              doc_offer_letter: bookingData.doc_offer_letter || [],
              doc_transfer_slip: bookingData.doc_transfer_slip || [],
              booking_id: id,
            }).eq("id", tenantId);
          } else {
            const { data: newTenant, error: tErr } = await supabase.from("tenants").insert({
              name: bookingData.tenant_name,
              phone: bookingData.tenant_phone,
              email: bookingData.tenant_email || "",
              ic_passport: bookingData.tenant_ic_passport || "",
              gender: bookingData.tenant_gender || "",
              nationality: bookingData.tenant_nationality || "",
              occupation: bookingData.occupation || "",
              company: bookingData.company || "",
              position: bookingData.position || "",
              monthly_salary: bookingData.monthly_salary || 0,
              car_plate: bookingData.car_plate || "",
              emergency_1_name: bookingData.emergency_1_name || "",
              emergency_1_phone: bookingData.emergency_1_phone || "",
              emergency_1_relationship: bookingData.emergency_1_relationship || "",
              emergency_2_name: bookingData.emergency_2_name || "",
              emergency_2_phone: bookingData.emergency_2_phone || "",
              emergency_2_relationship: bookingData.emergency_2_relationship || "",
              doc_passport: bookingData.doc_passport || [],
              doc_offer_letter: bookingData.doc_offer_letter || [],
              doc_transfer_slip: bookingData.doc_transfer_slip || [],
              booking_id: id,
            }).select("id").single();
            if (tErr) console.error("Failed to create tenant:", tErr);
            tenantId = newTenant?.id || "";
          }

          // Create tenant_rooms binding if room exists
          if (tenantId && room_id) {
            await supabase.from("tenant_rooms").insert({
              tenant_id: tenantId,
              room_id: room_id,
              move_in_date: bookingData.move_in_date || null,
              contract_months: bookingData.contract_months || 12,
              status: "active",
            });
          }

          // Create tenant_rooms for carparks too
          if (tenantId && carParkIds && carParkIds.length > 0) {
            for (const cpId of carParkIds) {
              await supabase.from("tenant_rooms").insert({
                tenant_id: tenantId,
                room_id: cpId,
                move_in_date: bookingData.move_in_date || null,
                contract_months: bookingData.contract_months || 12,
                status: "active",
              });
            }
          }
        }
      }

      // ─── REJECT: release room + carparks back to Available ───
      if (status === "rejected") {
        if (room_id) {
          await supabase.from("rooms").update({ status: "Available" }).eq("id", room_id);
        }
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", cpId);
          }
        }
      }

      // ─── CANCEL: release pending holds, handle forfeit ───
      if (status === "cancelled") {
        if (room_id) {
          // Only release if room is still Pending (not yet moved in)
          const { data: roomData } = await supabase.from("rooms").select("status").eq("id", room_id).single();
          if (roomData?.status === "Pending") {
            await supabase.from("rooms").update({ status: "Available" }).eq("id", room_id);
          }
        }
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            const { data: cpData } = await supabase.from("rooms").select("status").eq("id", cpId).single();
            if (cpData?.status === "Pending") {
              await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", cpId);
            }
          }
        }
        // Cancel related move-in if it exists and is still ready_for_move_in
        const { data: moveIns } = await supabase
          .from("move_ins")
          .select("id, status")
          .eq("booking_id", id)
          .eq("status", "ready_for_move_in");
        if (moveIns && moveIns.length > 0) {
          for (const mi of moveIns) {
            await supabase.from("move_ins").update({
              status: "rejected",
              cancel_reason: reject_reason || "Booking cancelled",
            }).eq("id", mi.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["move_ins"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

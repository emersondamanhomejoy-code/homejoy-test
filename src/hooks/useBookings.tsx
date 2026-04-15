import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BookingType = "room_only" | "room_carpark" | "carpark_only";

export type OrderStatus =
  | "booking_submitted"
  | "booking_rejected"
  | "booking_approved"
  | "booking_cancelled"
  | "move_in_submitted"
  | "move_in_rejected"
  | "move_in_approved";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  booking_submitted: "Booking Submitted",
  booking_rejected: "Booking Rejected",
  booking_approved: "Booking Approved",
  booking_cancelled: "Booking Cancelled",
  move_in_submitted: "Move-in Submitted",
  move_in_rejected: "Move-in Rejected",
  move_in_approved: "Move-in Approved",
};

export const ORDER_STATUS_LIST: OrderStatus[] = [
  "booking_submitted",
  "booking_rejected",
  "booking_approved",
  "booking_cancelled",
  "move_in_submitted",
  "move_in_rejected",
  "move_in_approved",
];

/** Valid transitions from each order status */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  booking_submitted: ["booking_rejected", "booking_approved", "booking_cancelled"],
  booking_rejected: ["booking_submitted", "booking_approved", "booking_cancelled"],
  booking_approved: ["move_in_submitted", "booking_cancelled"],
  move_in_submitted: ["move_in_rejected", "move_in_approved"],
  move_in_rejected: ["move_in_submitted", "move_in_approved", "booking_cancelled"],
  move_in_approved: [], // final
  booking_cancelled: [], // final
};

export interface Booking {
  id: string;
  room_id: string | null;
  unit_id: string | null;
  booking_type: BookingType;
  status: string; // legacy — keep for compatibility but prefer order_status
  order_status: OrderStatus;
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
  // Move-in fields (merged from move_ins)
  agreement_signed: boolean;
  payment_method: string;
  receipt_path: string;
  move_in_agent_id: string | null;
  move_in_reject_reason: string;
  move_in_cancel_reason: string;
  move_in_reviewed_by: string | null;
  move_in_reviewed_at: string | null;
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
      if (statusFilter) q = q.eq("order_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Booking[];
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      order_status,
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
      // Move-in fields
      agreement_signed,
      payment_method,
      receipt_path,
      move_in_reject_reason,
    }: {
      id: string;
      order_status: OrderStatus;
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
      agreement_signed?: boolean;
      payment_method?: string;
      receipt_path?: string;
      move_in_reject_reason?: string;
    }) => {
      const updates: Record<string, any> = {
        order_status,
        updated_at: new Date().toISOString(),
      };

      // Map order_status to legacy status field
      if (order_status.startsWith("booking_")) {
        updates.status = order_status.replace("booking_", "");
      } else if (order_status === "move_in_submitted" || order_status === "move_in_rejected") {
        updates.status = "approved"; // booking stays approved
      } else if (order_status === "move_in_approved") {
        updates.status = "approved";
      }

      if (history !== undefined) updates.history = history;
      if (resolution_type !== undefined) updates.resolution_type = resolution_type;

      // Booking-level review fields
      if (order_status === "booking_approved" || order_status === "booking_rejected" || order_status === "booking_cancelled") {
        updates.reviewed_by = reviewed_by;
        updates.reviewed_at = new Date().toISOString();
        updates.reject_reason = reject_reason || "";
      }

      // Move-in fields
      if (order_status === "move_in_submitted") {
        if (agreement_signed !== undefined) updates.agreement_signed = agreement_signed;
        if (payment_method !== undefined) updates.payment_method = payment_method;
        if (receipt_path !== undefined) updates.receipt_path = receipt_path;
        updates.move_in_agent_id = reviewed_by;
      }
      if (order_status === "move_in_approved") {
        updates.move_in_reviewed_by = reviewed_by;
        updates.move_in_reviewed_at = new Date().toISOString();
      }
      if (order_status === "move_in_rejected") {
        updates.move_in_reviewed_by = reviewed_by;
        updates.move_in_reviewed_at = new Date().toISOString();
        updates.move_in_reject_reason = move_in_reject_reason || reject_reason || "";
      }

      // Resubmit clears reject fields
      if (order_status === "booking_submitted") {
        updates.reject_reason = "";
        updates.reviewed_by = null;
        updates.reviewed_at = null;
      }

      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // ─── BOOKING APPROVED: set room/carpark to Occupied, create tenant ───
      if (order_status === "booking_approved") {
        if (room_id) {
          await supabase.from("rooms").update({ status: "Occupied" }).eq("id", room_id);
        }
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            await supabase.from("rooms").update({
              status: "Occupied",
              tenant_gender: `${tenant_name || ""} (${tenant_gender || ""})`,
            }).eq("id", cpId);
          }
        }

        // Create formal tenant record
        if (bookingData) {
          const { data: existingTenant } = await supabase
            .from("tenants")
            .select("id")
            .eq("phone", bookingData.tenant_phone)
            .eq("name", bookingData.tenant_name)
            .maybeSingle();

          let tenantId: string;
          if (existingTenant) {
            tenantId = existingTenant.id;
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

          if (tenantId && room_id) {
            await supabase.from("tenant_rooms").insert({
              tenant_id: tenantId,
              room_id: room_id,
              move_in_date: bookingData.move_in_date || null,
              contract_months: bookingData.contract_months || 12,
              status: "active",
            });
          }
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

      // ─── BOOKING REJECTED: release room + carparks back to Available ───
      if (order_status === "booking_rejected") {
        if (room_id) {
          await supabase.from("rooms").update({ status: "Available" }).eq("id", room_id);
        }
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", cpId);
          }
        }
      }

      // ─── MOVE-IN APPROVED: set room/carpark to Occupied, create earnings ───
      if (order_status === "move_in_approved") {
        if (room_id) {
          await supabase.from("rooms").update({ status: "Occupied" }).eq("id", room_id);
        }
        if (bookingData) {
          const docs = bookingData.documents as any;
          const carParkSelections: { roomId: string }[] = docs?.carParkSelections || [];
          for (const cp of carParkSelections) {
            if (cp.roomId) {
              await supabase.from("rooms").update({ status: "Occupied" }).eq("id", cp.roomId);
            }
          }

          // Auto-create earnings record
          const agentId = bookingData.submitted_by || reviewed_by;
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("commission_type, commission_config")
            .eq("user_id", agentId)
            .eq("role", "agent")
            .single();

          const commType = roleData?.commission_type || "internal_basic";
          const commConfig = roleData?.commission_config as any;
          const rent = bookingData.monthly_salary || 0;
          const duration = bookingData.contract_months || 12;
          const durationMultiplier = duration / 12;

          let commissionAmount = 0;
          if (commType === "external") {
            commissionAmount = Math.round(rent * (commConfig?.percentage ?? 100) / 100 * durationMultiplier);
          } else if (commType === "internal_full") {
            const tiers = commConfig?.tiers || [{ min: 1, max: 300, percentage: 70 }];
            const tier = tiers.find((t: any) => true);
            commissionAmount = Math.round(rent * (tier?.percentage ?? 70) / 100 * durationMultiplier);
          } else {
            const tiers = commConfig?.tiers || [{ min: 1, max: 5, amount: 200 }];
            const tier = tiers.find((t: any) => true);
            commissionAmount = Math.round((tier?.amount ?? 200) * durationMultiplier);
          }

          const room = bookingData.room;
          const now = new Date();
          const payCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

          await supabase.from("earnings").insert({
            agent_id: agentId,
            booking_id: id,
            room_id: room_id || null,
            tenant_name: bookingData.tenant_name,
            building: room?.building || "",
            unit: room?.unit || "",
            room: room?.room || "",
            exact_rental: rent,
            commission_type: commType,
            commission_amount: commissionAmount,
            status: "pending",
            pay_cycle: payCycle,
          });
        }
      }

      // ─── BOOKING CANCELLED: release Pending or Occupied holds back to Available ───
      if (order_status === "booking_cancelled") {
        if (room_id) {
          const { data: roomData } = await supabase.from("rooms").select("status").eq("id", room_id).single();
          if (roomData?.status === "Pending" || roomData?.status === "Occupied") {
            await supabase.from("rooms").update({ status: "Available" }).eq("id", room_id);
          }
        }
        if (carParkIds && carParkIds.length > 0) {
          for (const cpId of carParkIds) {
            const { data: cpData } = await supabase.from("rooms").select("status").eq("id", cpId).single();
            if (cpData?.status === "Pending" || cpData?.status === "Occupied") {
              await supabase.from("rooms").update({ status: "Available", tenant_gender: "" }).eq("id", cpId);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
}

// Keep legacy hook name for backward compatibility
export const useUpdateBookingStatus = useUpdateOrderStatus;

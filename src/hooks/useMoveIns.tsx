import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MoveIn {
  id: string;
  booking_id: string | null;
  room_id: string | null;
  agent_id: string;
  tenant_name: string;
  status: string;
  agreement_signed: boolean;
  payment_method: string;
  receipt_path: string;
  reject_reason: string;
  cancel_reason: string;
  history: any[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  room?: { room: string; building: string; unit: string } | null;
  booking?: { tenant_name: string; tenant_phone: string; move_in_date: string; contract_months: number } | null;
}

export function useMoveIns() {
  return useQuery({
    queryKey: ["move_ins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("move_ins")
        .select("*, room:rooms(room, building, unit), booking:bookings(tenant_name, tenant_phone, move_in_date, contract_months)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MoveIn[];
    },
  });
}

export function useCreateMoveIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      booking_id?: string | null;
      room_id?: string | null;
      agent_id: string;
      tenant_name: string;
      agreement_signed?: boolean;
      payment_method?: string;
      receipt_path?: string;
      status?: string;
      history?: any[];
    }) => {
      const { error } = await supabase.from("move_ins").insert({
        booking_id: payload.booking_id ?? null,
        room_id: payload.room_id ?? null,
        agent_id: payload.agent_id,
        tenant_name: payload.tenant_name,
        agreement_signed: payload.agreement_signed ?? false,
        payment_method: payload.payment_method ?? "",
        receipt_path: payload.receipt_path ?? "",
        status: payload.status ?? "pending_review",
        history: payload.history ?? [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["move_ins"] });
    },
  });
}

export function useUpdateMoveIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; [key: string]: any }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("move_ins").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["move_ins"] });
    },
  });
}

export function useClaimItems(claimId?: string) {
  return useQuery({
    queryKey: ["claim_items", claimId],
    enabled: !!claimId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claim_items")
        .select("*")
        .eq("claim_id", claimId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
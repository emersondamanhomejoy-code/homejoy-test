import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClaimItem {
  id: string;
  claim_id: string;
  room_id: string | null;
  building: string;
  unit: string;
  room: string;
  tenant_name: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  agent_id: string;
  booking_id: string | null;
  amount: number;
  description: string;
  status: string;
  bank_name: string;
  bank_account: string;
  account_holder: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string;
  cancel_reason: string;
  history: any[];
  payout_date: string | null;
  created_at: string;
  updated_at: string;
  // joined
  claim_items?: ClaimItem[];
}

export function useClaims() {
  return useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*, claim_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Claim[];
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
      return data as unknown as ClaimItem[];
    },
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (claim: {
      agent_id: string;
      booking_id?: string;
      amount: number;
      description: string;
      bank_name: string;
      bank_account: string;
      account_holder: string;
    }) => {
      const { error } = await supabase.from("claims").insert(claim);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

export function useUpdateClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status: string;
      reviewed_by: string;
      reject_reason?: string;
      cancel_reason?: string;
      history?: any[];
      payout_date?: string | null;
    }) => {
      const updates: any = {
        status: payload.status,
        reviewed_by: payload.reviewed_by,
        reviewed_at: new Date().toISOString(),
      };
      if (payload.reject_reason !== undefined) updates.reject_reason = payload.reject_reason;
      if (payload.cancel_reason !== undefined) updates.cancel_reason = payload.cancel_reason;
      if (payload.history !== undefined) updates.history = payload.history;
      if (payload.payout_date !== undefined) updates.payout_date = payload.payout_date;
      const { error } = await supabase.from("claims").update(updates).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

export function useUpdateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; [key: string]: any }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("claims").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

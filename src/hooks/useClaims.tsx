import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
  updated_at: string;
}

export function useClaims() {
  return useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Claim[];
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
    }) => {
      const { error } = await supabase
        .from("claims")
        .update({
          status: payload.status,
          reviewed_by: payload.reviewed_by,
          reviewed_at: new Date().toISOString(),
          reject_reason: payload.reject_reason || "",
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

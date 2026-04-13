import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all agents who are not frozen
    const { data: agentRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "agent");

    if (rolesError) throw rolesError;
    if (!agentRoles || agentRoles.length === 0) {
      return new Response(JSON.stringify({ message: "No agents found", frozen_count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentIds = agentRoles.map(r => r.user_id);

    // Get profiles that are NOT frozen
    const { data: activeProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .in("user_id", agentIds)
      .eq("frozen", false);

    if (!activeProfiles || activeProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active agents to check", frozen_count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeAgentIds = activeProfiles.map(p => p.user_id);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const cutoffDate = twoMonthsAgo.toISOString();

    let frozenCount = 0;

    for (const agentId of activeAgentIds) {
      // Check if agent has any approved bookings in last 2 months
      const { data: recentBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("submitted_by", agentId)
        .gte("created_at", cutoffDate)
        .limit(1);

      // Check if agent has any approved move-ins in last 2 months
      const { data: recentMoveIns } = await supabase
        .from("move_ins")
        .select("id")
        .eq("agent_id", agentId)
        .gte("created_at", cutoffDate)
        .limit(1);

      const hasDeals = (recentBookings && recentBookings.length > 0) || (recentMoveIns && recentMoveIns.length > 0);

      if (!hasDeals) {
        await supabase.from("profiles").update({
          frozen: true,
          frozen_at: new Date().toISOString(),
        }).eq("user_id", agentId);

        // Log the auto-freeze
        await supabase.from("activity_logs").insert({
          actor_id: agentId,
          actor_email: "system",
          action: "auto_freeze",
          entity_type: "user",
          entity_id: agentId,
          details: { reason: "No deals in 2 months", auto: true },
        });

        frozenCount++;
      }
    }

    return new Response(JSON.stringify({ message: `Auto-freeze complete`, frozen_count: frozenCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-freeze error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

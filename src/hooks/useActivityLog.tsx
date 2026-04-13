import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  action: string,
  entityType: string,
  entityId: string = "",
  details: Record<string, any> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch actor role for audit trail
    let actorRole = "";
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1);
      if (roleData && roleData.length > 0) actorRole = roleData[0].role;
    } catch {}

    await supabase.from("activity_logs").insert({
      actor_id: user.id,
      actor_email: user.email || "",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: { ...details, actor_role: actorRole },
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

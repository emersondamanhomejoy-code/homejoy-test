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

    await supabase.from("activity_logs" as any).insert({
      actor_id: user.id,
      actor_email: user.email || "",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    } as any);
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

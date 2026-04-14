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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "boss", "manager"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin/Boss/Manager only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body.action || "list";

    // INVITE USER
    if (action === "create") {
      const { email, name, phone, address, role: newRole, commission_type, commission_config, display_name, emergency_contact_name, emergency_contact_phone } = body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Valid email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validRoles = ["admin", "agent", "boss", "manager"];
      const assignRole = validRoles.includes(newRole) ? newRole : "agent";

      const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://homejoyagent.lovable.app";
      const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(
        email.trim(),
        {
          data: { full_name: name || "" },
          redirectTo: `${siteUrl}/set-password`,
        }
      );

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newUser.user) {
        await supabase.from("profiles").upsert({
          user_id: newUser.user.id,
          email: email.trim(),
          name: name || "",
          display_name: display_name || "",
          phone: phone || "",
          address: address || "",
          emergency_contact_name: emergency_contact_name || "",
          emergency_contact_phone: emergency_contact_phone || "",
        }, { onConflict: "user_id" });

        if (assignRole !== "agent") {
          await supabase.from("user_roles").delete().eq("user_id", newUser.user.id).eq("role", "agent");
        }
        await supabase.from("user_roles").upsert({
          user_id: newUser.user.id,
          role: assignRole,
          commission_type: commission_type || "internal_basic",
          commission_config: commission_config || null,
        }, { onConflict: "user_id,role" });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESEND INVITE
    if (action === "resend_invite") {
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const siteUrl2 = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://homejoyagent.lovable.app";
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
        redirectTo: `${siteUrl2}/set-password`,
      });
      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SET PASSWORD
    if (action === "set_password") {
      const { user_id, password } = body;
      if (!user_id || !password || password.length < 6) {
        return new Response(JSON.stringify({ error: "user_id and password (min 6 chars) required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, { password });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("user_roles").delete().eq("user_id", user_id);
      await supabase.from("profiles").delete().eq("user_id", user_id);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FREEZE / UNFREEZE USER
    if (action === "freeze_user" || action === "unfreeze_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot freeze yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isFreezing = action === "freeze_user";
      const { error: freezeError } = await supabase.from("profiles").update({
        frozen: isFreezing,
        frozen_at: isFreezing ? new Date().toISOString() : null,
      }).eq("user_id", user_id);

      if (freezeError) {
        return new Response(JSON.stringify({ error: freezeError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHECK FROZEN (public — no admin role required, called at login)
    if (action === "check_frozen") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase.from("profiles").select("frozen").eq("user_id", user_id).limit(1).single();
      return new Response(JSON.stringify({ frozen: profile?.frozen || false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE PROFILE
    if (action === "update_profile") {
      const { user_id, name, display_name, phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, ic_document, bank_name, bank_account, bank_proof } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: any = {
        user_id,
        name: name || "",
        phone: phone || "",
        address: address || "",
      };
      if (display_name !== undefined) updateData.display_name = display_name;
      if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name;
      if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone;
      if (emergency_contact_relationship !== undefined) updateData.emergency_contact_relationship = emergency_contact_relationship;
      if (ic_document !== undefined) updateData.ic_document = ic_document;
      if (bank_name !== undefined) updateData.bank_name = bank_name;
      if (bank_account !== undefined) updateData.bank_account = bank_account;
      if (bank_proof !== undefined) updateData.bank_proof = bank_proof;

      await supabase.from("profiles").upsert(updateData, { onConflict: "user_id" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST USERS (default)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role, commission_type, commission_config");
    if (rolesError) throw rolesError;

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, name, display_name, phone, address, profile_picture_url, ic_document, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, frozen, frozen_at, bank_name, bank_account, bank_proof");
    if (profilesError) throw profilesError;

    const result = users.map((u) => {
      const userRoles = roles?.filter((r) => r.user_id === u.id) ?? [];
      const agentRole = userRoles.find((r) => r.role === "agent");
      const profile = profiles?.find((p) => p.user_id === u.id);
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
        roles: userRoles.map((r) => r.role),
        commission_type: agentRole?.commission_type || "internal_basic",
        commission_config: agentRole?.commission_config || null,
        name: profile?.name || "",
        display_name: profile?.display_name || "",
        phone: profile?.phone || "",
        address: profile?.address || "",
        profile_picture_url: profile?.profile_picture_url || "",
        ic_document: profile?.ic_document || "",
        emergency_contact_name: profile?.emergency_contact_name || "",
        emergency_contact_phone: profile?.emergency_contact_phone || "",
        emergency_contact_relationship: profile?.emergency_contact_relationship || "",
        frozen: profile?.frozen || false,
        frozen_at: profile?.frozen_at || null,
        bank_name: profile?.bank_name || "",
        bank_account: profile?.bank_account || "",
        bank_proof: profile?.bank_proof || "",
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

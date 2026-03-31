import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      navigate("/");
    }
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (user && role === "admin") {
      fetchUsers();
    }
  }, [user, role]);

  const fetchUsers = async () => {
    setFetching(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      setUsers(res.data as UserWithRoles[]);
    } catch (e: any) {
      setError(e.message || "Failed to fetch users");
    } finally {
      setFetching(false);
    }
  };

  const toggleRole = async (userId: string, targetRole: "admin" | "agent", hasRole: boolean) => {
    setUpdating(userId + targetRole);
    try {
      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", targetRole);
        if (error) throw error;
      } else {
        // Add role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: targetRole });
        if (error) throw error;
      }
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1">User Management</div>
          </div>
          <span className="text-sm text-muted-foreground">{users.length} users</span>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>
        )}

        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary">
                <th className="text-left px-5 py-3 font-semibold">Email</th>
                <th className="text-left px-5 py-3 font-semibold">Joined</th>
                <th className="text-left px-5 py-3 font-semibold">Roles</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.roles.includes("admin");
                const isAgent = u.roles.includes("agent");
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-4 font-medium">{u.email}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {u.roles.map((r) => (
                          <span key={r} className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-semibold uppercase">
                            {r}
                          </span>
                        ))}
                        {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => toggleRole(u.id, "admin", isAdmin)}
                          disabled={updating === u.id + "admin" || u.id === user?.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            isAdmin
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {isAdmin ? "Remove Admin" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => toggleRole(u.id, "agent", isAgent)}
                          disabled={updating === u.id + "agent"}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            isAgent
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {isAgent ? "Remove Agent" : "Make Agent"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/StatusBadge";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Eye, Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Upload, X, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";

interface CommissionTier { min: number; max: number | null; amount?: number; percentage?: number; }
interface CommissionConfig { percentage?: number; tiers?: CommissionTier[]; }
interface UserWithRoles {
  id: string; email: string; created_at: string; confirmed: boolean;
  roles: string[]; commission_type: string; commission_config: CommissionConfig | null;
  name: string; display_name: string; phone: string; address: string;
  profile_picture_url: string; ic_document: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  frozen: boolean; frozen_at: string | null;
}

const defaultConfigs: Record<string, CommissionConfig> = {
  external: { percentage: 100 },
  internal_basic: { tiers: [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }] },
  internal_full: { tiers: [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }] },
};

export function UsersPage() {
  const { user, role } = useAuth();
  const canCreateRoles = role === "boss" ? ["manager", "admin", "agent"] : role === "manager" ? ["admin", "agent"] : ["agent"];

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [viewUser, setViewUser] = useState<UserWithRoles | null>(null);
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<UserWithRoles | null>(null);
  const [saving, setSaving] = useState(false);
  const [freezingId, setFreezingId] = useState<string | null>(null);

  const [newAgent, setNewAgent] = useState({
    email: "", name: "", display_name: "", phone: "", address: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    role: "agent", commission_type: "internal_basic",
    commission_config: defaultConfigs.internal_basic as CommissionConfig,
  });

  const [editForm, setEditForm] = useState({
    name: "", display_name: "", phone: "", address: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    ic_document: "", commission_type: "", commission_config: null as CommissionConfig | null,
  });

  const profilePicRef = useRef<HTMLInputElement>(null);
  const icUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingIc, setUploadingIc] = useState(false);

  const fetchUsers = async () => {
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      setUsers(res.data as UserWithRoles[]);
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch users");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { if (user) fetchUsers(); }, [user]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter(u => u.roles.includes(roleFilter));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || (u.display_name || "").toLowerCase().includes(s));
    }
    return sortData(list, (u: UserWithRoles, key: string) => {
      const map: Record<string, any> = { name: u.name, email: u.email, role: u.roles.join(","), commission_type: u.commission_type, created_at: u.created_at };
      return map[key];
    });
  }, [users, roleFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const createUser = async () => {
    if (!newAgent.email.trim()) { toast.error("Email is required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: "create", ...newAgent },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logActivity("create_user", "user", "", { email: newAgent.email, name: newAgent.name });
      toast.success("Invite sent!");
      setNewAgent({ email: "", name: "", display_name: "", phone: "", address: "", emergency_contact_name: "", emergency_contact_phone: "", role: "agent", commission_type: "internal_basic", commission_config: defaultConfigs.internal_basic });
      setShowAddUser(false);
      await fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to invite user");
    } finally {
      setSaving(false);
    }
  };

  const uploadProfilePicture = async (file: File, userId: string) => {
    setUploadingPic(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage.from("booking-docs").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("booking-docs").getPublicUrl(path);
      // Update profile
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("profiles").update({ profile_picture_url: publicUrl }).eq("user_id", userId);
      toast.success("Profile picture updated");
      await fetchUsers();
      if (editUser) setEditUser({ ...editUser, profile_picture_url: publicUrl });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingPic(false);
    }
  };

  const uploadIcDocument = async (file: File, userId: string) => {
    setUploadingIc(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/ic.${ext}`;
      const { error: uploadError } = await supabase.storage.from("booking-docs").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("booking-docs").getPublicUrl(path);
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: "update_profile", user_id: userId, ic_document: publicUrl },
      });
      toast.success("IC document uploaded");
      await fetchUsers();
      if (editUser) {
        setEditUser({ ...editUser, ic_document: publicUrl });
        setEditForm(f => ({ ...f, ic_document: publicUrl }));
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingIc(false);
    }
  };

  const saveProfile = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          action: "update_profile", user_id: editUser.id,
          name: editForm.name, display_name: editForm.display_name,
          phone: editForm.phone, address: editForm.address,
          emergency_contact_name: editForm.emergency_contact_name,
          emergency_contact_phone: editForm.emergency_contact_phone,
          ic_document: editForm.ic_document,
        },
      });
      if (editUser.roles.includes("agent") && editForm.commission_type) {
        await supabase.from("user_roles")
          .update({ commission_type: editForm.commission_type, commission_config: editForm.commission_config as unknown as import("@/integrations/supabase/types").Json })
          .eq("user_id", editUser.id).eq("role", "agent");
      }
      toast.success("User updated");
      setEditUser(null);
      await fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: "delete_user", user_id: showDeleteDialog.id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logActivity("delete_user", "user", showDeleteDialog.id, { email: showDeleteDialog.email });
      toast.success("User deleted");
      setShowDeleteDialog(null);
      await fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const handleFreezeToggle = async (u: UserWithRoles) => {
    setFreezingId(u.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { action: u.frozen ? "unfreeze_user" : "freeze_user", user_id: u.id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logActivity(u.frozen ? "unfreeze_user" : "freeze_user", "user", u.id, { email: u.email });
      toast.success(u.frozen ? "User unfrozen" : "User frozen");
      await fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update freeze status");
    } finally {
      setFreezingId(null);
    }
  };

  const openEdit = (u: UserWithRoles) => {
    setEditUser(u);
    setEditForm({
      name: u.name, display_name: u.display_name || "", phone: u.phone, address: u.address,
      emergency_contact_name: u.emergency_contact_name || "", emergency_contact_phone: u.emergency_contact_phone || "",
      ic_document: u.ic_document || "",
      commission_type: u.commission_type,
      commission_config: u.commission_config ? { ...u.commission_config, tiers: u.commission_config.tiers?.map(t => ({ ...t })) } : defaultConfigs[u.commission_type],
    });
  };

  const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full text-sm";
  const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  const commSummary = (u: UserWithRoles) => {
    const cfg = u.commission_config || defaultConfigs[u.commission_type] || defaultConfigs.internal_basic;
    if (u.commission_type === "external") return `External (${cfg.percentage ?? 100}%)`;
    if (u.commission_type === "internal_full") return `Internal Full`;
    return `Internal Basic`;
  };

  const renderCommissionEditor = (type: string, config: CommissionConfig, onChange: (type: string, config: CommissionConfig) => void) => (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className={lbl}>Commission Type</label>
        <select className={ic} value={type} onChange={e => onChange(e.target.value, defaultConfigs[e.target.value] || defaultConfigs.internal_basic)}>
          <option value="internal_basic">Internal Basic (RM tiers)</option>
          <option value="internal_full">Internal Full (% tiers)</option>
          <option value="external">External (%)</option>
        </select>
      </div>
      {type === "external" && (
        <div className="flex items-center gap-2">
          <label className={lbl}>%</label>
          <input className={`${ic} w-24`} type="number" value={config.percentage ?? 100} onChange={e => onChange(type, { percentage: Number(e.target.value) })} />
          <span className="text-xs text-muted-foreground">of monthly rent</span>
        </div>
      )}
      {(type === "internal_basic" || type === "internal_full") && (
        <div className="space-y-2">
          <div className={lbl}>Tiers</div>
          {(config.tiers || []).map((tier, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input className={`${ic} w-20`} type="number" value={tier.min} onChange={e => {
                const tiers = [...(config.tiers || [])]; tiers[i] = { ...tiers[i], min: Number(e.target.value) };
                onChange(type, { tiers });
              }} />
              <span className="text-xs text-muted-foreground">to</span>
              <input className={`${ic} w-20`} type="number" value={tier.max ?? ""} onChange={e => {
                const tiers = [...(config.tiers || [])]; tiers[i] = { ...tiers[i], max: e.target.value ? Number(e.target.value) : null };
                onChange(type, { tiers });
              }} />
              <span className="text-xs text-muted-foreground">→</span>
              {type === "internal_basic" ? (
                <><span className="text-xs">RM</span><input className={`${ic} w-20`} type="number" value={tier.amount ?? 0} onChange={e => { const tiers = [...(config.tiers || [])]; tiers[i] = { ...tiers[i], amount: Number(e.target.value) }; onChange(type, { tiers }); }} /></>
              ) : (
                <><input className={`${ic} w-20`} type="number" value={tier.percentage ?? 0} onChange={e => { const tiers = [...(config.tiers || [])]; tiers[i] = { ...tiers[i], percentage: Number(e.target.value) }; onChange(type, { tiers }); }} /><span className="text-xs">%</span></>
              )}
              <button onClick={() => { const tiers = (config.tiers || []).filter((_, idx) => idx !== i); onChange(type, { tiers }); }} className="text-destructive text-xs hover:underline">✕</button>
            </div>
          ))}
          <button onClick={() => {
            const tiers = [...(config.tiers || [])];
            const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max ?? 0) + 1 : 1;
            tiers.push({ min: lastMax, max: null, ...(type === "internal_basic" ? { amount: 0 } : { percentage: 0 }) });
            onChange(type, { tiers });
          }} className="text-xs text-primary hover:underline">+ Add Tier</button>
        </div>
      )}
    </div>
  );

  const sectionCard = (emoji: string, title: string, children: React.ReactNode) => (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">{emoji} {title}</div>
      {children}
    </div>
  );
  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );

  const avatarDisplay = (u: UserWithRoles, size = "w-8 h-8", textSize = "text-sm") => (
    u.profile_picture_url ? (
      <img src={u.profile_picture_url} alt={u.name} className={`${size} rounded-full object-cover mx-auto`} />
    ) : (
      <div className={`${size} bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold ${textSize} mx-auto`}>
        {(u.name || u.email)[0]?.toUpperCase()}
      </div>
    )
  );

  const renderCommissionTiersSummary = (u: UserWithRoles) => {
    const cfg = u.commission_config || defaultConfigs[u.commission_type] || defaultConfigs.internal_basic;
    if (u.commission_type === "external") return <span>{cfg.percentage ?? 100}% of monthly rent</span>;
    if (!cfg.tiers?.length) return <span>—</span>;
    return (
      <div className="space-y-0.5">
        {cfg.tiers.map((t, i) => (
          <div key={i} className="text-xs">
            {t.min}–{t.max ?? "∞"} rooms → {u.commission_type === "internal_basic" ? `RM${t.amount}` : `${t.percentage}%`}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={e => {
        const file = e.target.files?.[0];
        if (file && editUser) uploadProfilePicture(file, editUser.id);
        e.target.value = "";
      }} />
      <input ref={icUploadRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
        const file = e.target.files?.[0];
        if (file && editUser) uploadIcDocument(file, editUser.id);
        e.target.value = "";
      }} />

      {/* Add User Modal */}
      <Dialog open={showAddUser} onOpenChange={(open) => { if (!open && !saving) setShowAddUser(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Add User</DialogTitle></DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
            <div className="space-y-5 py-4">
              {sectionCard("👤", "User Details", (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                      {(newAgent.name || newAgent.email || "?")[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs text-muted-foreground">Profile picture can be uploaded after account creation</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} /></div>
                    <div className="space-y-1"><label className={lbl}>Display Name</label><input className={ic} placeholder="Optional" value={newAgent.display_name} onChange={e => setNewAgent({ ...newAgent, display_name: e.target.value })} /></div>
                    <div className="space-y-1"><label className={lbl}>Email *</label><input className={ic} type="email" value={newAgent.email} onChange={e => setNewAgent({ ...newAgent, email: e.target.value })} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone Number</label><input className={ic} value={newAgent.phone} onChange={e => setNewAgent({ ...newAgent, phone: e.target.value })} /></div>
                    <div className="md:col-span-2 space-y-1"><label className={lbl}>Address</label><input className={ic} value={newAgent.address} onChange={e => setNewAgent({ ...newAgent, address: e.target.value })} /></div>
                  </div>
                </div>
              ))}

              {sectionCard("🚨", "Emergency Contact", (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={lbl}>Contact Name</label><input className={ic} value={newAgent.emergency_contact_name} onChange={e => setNewAgent({ ...newAgent, emergency_contact_name: e.target.value })} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact Phone</label><input className={ic} value={newAgent.emergency_contact_phone} onChange={e => setNewAgent({ ...newAgent, emergency_contact_phone: e.target.value })} /></div>
                </div>
              ))}

              {sectionCard("🔑", "Role & Access", (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className={lbl}>Role *</label>
                    <select className={ic} value={newAgent.role} onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}>
                      {canCreateRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">IC document can be uploaded after account creation</p>
                </div>
              ))}

              {newAgent.role === "agent" && sectionCard("💰", "Commission", (
                renderCommissionEditor(newAgent.commission_type, newAgent.commission_config, (type, config) => setNewAgent({ ...newAgent, commission_type: type, commission_config: config }))
              ))}

              <p className="text-xs text-muted-foreground">User will receive an email invitation link to set up their password.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddUser(false)} disabled={saving}>Cancel</Button>
                <Button onClick={createUser} disabled={saving}>{saving ? "Sending..." : "Send Invite"}</Button>
              </DialogFooter>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      {viewUser && (
        <Dialog open={!!viewUser} onOpenChange={(open) => { if (!open) setViewUser(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View User</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              <div className="space-y-5 py-4">
                {sectionCard("👤", "Profile", (
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      {avatarDisplay(viewUser, "w-20 h-20", "text-2xl")}
                      <div>
                        <div className="font-bold text-lg">{viewUser.name || "—"}</div>
                        {viewUser.display_name && <div className="text-sm text-muted-foreground">Display: {viewUser.display_name}</div>}
                      </div>
                    </div>
                    {infoRow("Full Name", viewUser.name)}
                    {infoRow("Display Name", viewUser.display_name)}
                    {infoRow("Email", viewUser.email)}
                    {infoRow("Phone", viewUser.phone)}
                    {infoRow("Address", viewUser.address)}
                    {infoRow("Roles", viewUser.roles.map(r => r.toUpperCase()).join(", "))}
                    {infoRow("Status", viewUser.confirmed ? "Confirmed" : "Pending Invite")}
                    {infoRow("Joined", format(new Date(viewUser.created_at), "dd MMM yyyy"))}
                  </div>
                ))}

                {sectionCard("🚨", "Emergency Contact", (
                  <div>
                    {infoRow("Name", viewUser.emergency_contact_name)}
                    {infoRow("Phone", viewUser.emergency_contact_phone)}
                  </div>
                ))}

                {sectionCard("📄", "Documents", (
                  <div>
                    {infoRow("IC Document", viewUser.ic_document ? (
                      <a href={viewUser.ic_document} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View IC</a>
                    ) : "Not uploaded")}
                  </div>
                ))}

                {viewUser.roles.includes("agent") && sectionCard("💰", "Commission", (
                  <div>
                    {infoRow("Type", commSummary(viewUser))}
                    <div className="mt-2">{renderCommissionTiersSummary(viewUser)}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={(open) => { if (!open && !saving) setEditUser(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Edit User — {editUser.name || editUser.email}</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              <div className="space-y-5 py-4">
                {sectionCard("👤", "Profile", (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {avatarDisplay(editUser, "w-20 h-20", "text-2xl")}
                      <div className="space-y-1">
                        <Button variant="outline" size="sm" disabled={uploadingPic} onClick={() => profilePicRef.current?.click()}>
                          <Upload className="h-3 w-3 mr-1" />{uploadingPic ? "Uploading..." : "Change Photo"}
                        </Button>
                        <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1"><label className={lbl}>Full Name</label><input className={ic} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                      <div className="space-y-1"><label className={lbl}>Display Name</label><input className={ic} placeholder="Optional" value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} /></div>
                      <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} value={editUser.email} disabled /></div>
                      <div className="space-y-1"><label className={lbl}>Phone Number</label><input className={ic} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                      <div className="md:col-span-2 space-y-1"><label className={lbl}>Address</label><input className={ic} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
                    </div>
                  </div>
                ))}

                {sectionCard("🚨", "Emergency Contact", (
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className={lbl}>Contact Name</label><input className={ic} value={editForm.emergency_contact_name} onChange={e => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} /></div>
                    <div className="space-y-1"><label className={lbl}>Contact Phone</label><input className={ic} value={editForm.emergency_contact_phone} onChange={e => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} /></div>
                  </div>
                ))}

                {sectionCard("📄", "Documents", (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className={lbl}>IC Document</label>
                      {editForm.ic_document ? (
                        <div className="flex items-center gap-2">
                          <a href={editForm.ic_document} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View current IC</a>
                          <Button variant="outline" size="sm" disabled={uploadingIc} onClick={() => icUploadRef.current?.click()}>
                            <Upload className="h-3 w-3 mr-1" />{uploadingIc ? "Uploading..." : "Replace"}
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" disabled={uploadingIc} onClick={() => icUploadRef.current?.click()}>
                          <Upload className="h-3 w-3 mr-1" />{uploadingIc ? "Uploading..." : "Upload IC"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {editUser.roles.includes("agent") && sectionCard("💰", "Commission", (
                  <>
                    {renderCommissionEditor(editForm.commission_type, editForm.commission_config || defaultConfigs.internal_basic, (type, config) => setEditForm({ ...editForm, commission_type: type, commission_config: config }))}
                    <p className="text-xs text-muted-foreground mt-2">⚠️ Changes only apply to future claims. Approved historical commissions are not affected.</p>
                  </>
                ))}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete User?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. User: {showDeleteDialog?.email}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Users</h2>
        <Button onClick={() => setShowAddUser(true)}><Plus className="h-4 w-4 mr-1" /> Add User</Button>
      </div>

      {/* Search + Role filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search name, email..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="boss">Boss</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {fetching ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Display Name</SortableTableHead>
                <TableHead>Full Name</TableHead>
                <SortableTableHead sortKey="email" currentSort={sort} onSort={handleSort}>Email</SortableTableHead>
                <TableHead>Phone</TableHead>
                <SortableTableHead sortKey="role" currentSort={sort} onSort={handleSort}>Role</SortableTableHead>
                <SortableTableHead sortKey="commission_type" currentSort={sort} onSort={handleSort}>Commission</SortableTableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-muted-foreground py-8 text-center">No users found</TableCell></TableRow>
              ) : paged.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="text-center">{avatarDisplay(u)}</TableCell>
                  <TableCell className="font-medium">{u.display_name || u.name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map(r => (
                        <span key={r} className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${r === "boss" ? "bg-amber-100 text-amber-700" : r === "manager" ? "bg-purple-100 text-purple-700" : r === "admin" ? "bg-blue-100 text-blue-700" : "bg-secondary text-secondary-foreground"}`}>{r}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.roles.includes("agent") ? commSummary(u) : "—"}</TableCell>
                  <TableCell className="text-center">{u.confirmed ? <StatusBadge status="Approved" /> : <StatusBadge status="Pending" />}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" onClick={() => setViewUser(u)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      {u.id !== user?.id && (
                        <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(u)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

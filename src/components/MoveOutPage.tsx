import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StandardModal } from "@/components/ui/standard-modal";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inputClass, labelClass } from "@/lib/ui-constants";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

const MOVE_OUT_TYPES = ["Tenancy Ended", "Early Move-out", "Parking Returned", "Internal Transfer", "Eviction", "Other"];
const NEXT_STATUS_OPTIONS = ["Available", "Available Soon", "Archived"];

interface MoveOut {
  id: string;
  tenant_name: string;
  tenant_id: string | null;
  asset_type: string;
  building: string;
  unit: string;
  room: string;
  room_id: string | null;
  move_out_type: string;
  effective_date: string;
  next_status: string;
  reason: string;
  status: string;
  history: any[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ActiveOccupancy {
  tenant_room_id: string;
  tenant_id: string;
  tenant_name: string;
  room_id: string;
  building: string;
  unit: string;
  room: string;
  room_type: string;
  status: string;
  rent: number;
  location: string;
}

const emptyForm = {
  tenant_name: "",
  tenant_id: "" as string,
  building: "",
  unit: "",
  room: "",
  room_id: "" as string,
  move_out_type: "",
  effective_date: format(new Date(), "yyyy-MM-dd"),
  next_status: "Available",
  reason: "",
};

export function MoveOutPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const queryClient = useQueryClient();
  const lbl = labelClass;

  // Fetch move_outs
  const { data: moveOuts = [], isLoading } = useQuery({
    queryKey: ["move_outs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("move_outs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MoveOut[];
    },
  });

  // Fetch active occupancies
  const { data: occupancies = [] } = useQuery({
    queryKey: ["active_occupancies"],
    queryFn: async () => {
      const { data: trData, error: trErr } = await supabase
        .from("tenant_rooms")
        .select("id, tenant_id, room_id, status")
        .eq("status", "active");
      if (trErr) throw trErr;
      if (!trData || trData.length === 0) return [];

      const tenantIds = [...new Set(trData.map(t => t.tenant_id))];
      const roomIds = [...new Set(trData.map(t => t.room_id))];

      const [{ data: tenants }, { data: rooms }] = await Promise.all([
        supabase.from("tenants").select("id, name").in("id", tenantIds),
        supabase.from("rooms").select("id, building, unit, room, room_type, status, rent, location").in("id", roomIds),
      ]);

      const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t]));
      const roomMap = Object.fromEntries((rooms || []).map(r => [r.id, r]));

      return trData.map(tr => {
        const tenant = tenantMap[tr.tenant_id];
        const room = roomMap[tr.room_id];
        return {
          tenant_room_id: tr.id,
          tenant_id: tr.tenant_id,
          tenant_name: tenant?.name || "Unknown",
          room_id: tr.room_id,
          building: room?.building || "",
          unit: room?.unit || "",
          room: room?.room || "",
          room_type: room?.room_type || "",
          status: room?.status || "",
          rent: room?.rent || 0,
          location: room?.location || "",
        } as ActiveOccupancy;
      });
    },
  });

  // State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [nextStatusFilter, setNextStatusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // View state
  const [viewItem, setViewItem] = useState<MoveOut | null>(null);

  // Unique values for filters
  const buildings = useMemo(() => [...new Set(moveOuts.map(m => m.building).filter(Boolean))].sort(), [moveOuts]);

  // Filter
  const filtered = useMemo(() => {
    let list = moveOuts;
    if (typeFilter !== "all") list = list.filter(m => m.move_out_type === typeFilter);
    if (dateFrom) list = list.filter(m => m.effective_date >= dateFrom);
    if (dateTo) list = list.filter(m => m.effective_date <= dateTo);
    if (buildingFilter !== "all") list = list.filter(m => m.building === buildingFilter);
    if (nextStatusFilter !== "all") list = list.filter(m => m.next_status === nextStatusFilter);
    if (statusFilter !== "all") list = list.filter(m => m.status === statusFilter);
    if (createdFrom) list = list.filter(m => m.created_at >= createdFrom);
    if (createdTo) list = list.filter(m => m.created_at <= createdTo + "T23:59:59");
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(m =>
        m.tenant_name.toLowerCase().includes(s) ||
        m.building.toLowerCase().includes(s) ||
        m.unit.toLowerCase().includes(s) ||
        m.room.toLowerCase().includes(s)
      );
    }
    return sortData(list, (m: MoveOut, key: string) => {
      const map: Record<string, any> = {
        effective_date: m.effective_date,
        tenant_name: m.tenant_name,
        building: m.building,
        move_out_type: m.move_out_type,
        created_at: m.created_at,
        status: m.status,
      };
      return map[key] ?? "";
    });
  }, [moveOuts, typeFilter, dateFrom, dateTo, buildingFilter, nextStatusFilter, statusFilter, createdFrom, createdTo, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasFilters = search.trim() !== "" || typeFilter !== "all" || dateFrom !== "" || dateTo !== "" || buildingFilter !== "all" || nextStatusFilter !== "all" || statusFilter !== "all" || createdFrom !== "" || createdTo !== "";

  const clearAll = () => {
    setSearch(""); setTypeFilter("all"); setDateFrom(""); setDateTo("");
    setBuildingFilter("all"); setNextStatusFilter("all");
    setStatusFilter("all"); setCreatedFrom(""); setCreatedTo(""); setPage(0);
  };

  // Tenants who have active occupancy
  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>();
    occupancies.forEach(o => map.set(o.tenant_id, o.tenant_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [occupancies]);

  // Occupied assets for selected tenant
  const tenantAssets = useMemo(() => {
    if (!form.tenant_id) return [];
    return occupancies.filter(o => o.tenant_id === form.tenant_id);
  }, [occupancies, form.tenant_id]);

  // Open create
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, effective_date: format(new Date(), "yyyy-MM-dd") });
    setIsDirty(false);
    setShowForm(true);
  };

  // Open edit (only for draft)
  const openEdit = (m: MoveOut) => {
    setEditingId(m.id);
    setForm({
      tenant_name: m.tenant_name,
      tenant_id: m.tenant_id || "",
      building: m.building,
      unit: m.unit,
      room: m.room,
      room_id: m.room_id || "",
      move_out_type: m.move_out_type,
      effective_date: m.effective_date,
      next_status: m.next_status,
      reason: m.reason,
    });
    setIsDirty(false);
    setShowForm(true);
  };

  const updateForm = (patch: Partial<typeof form>) => {
    setForm(f => ({ ...f, ...patch }));
    setIsDirty(true);
  };

  // When tenant changes, reset asset selection
  const handleTenantChange = (tenantId: string) => {
    const tenant = tenantOptions.find(t => t[0] === tenantId);
    updateForm({
      tenant_id: tenantId,
      tenant_name: tenant?.[1] || "",
      building: "",
      unit: "",
      room: "",
      room_id: "",
    });
  };

  // When asset selected
  const handleAssetSelect = (roomId: string) => {
    const occ = occupancies.find(o => o.room_id === roomId && o.tenant_id === form.tenant_id);
    if (occ) {
      updateForm({
        room_id: roomId,
        building: occ.building,
        unit: occ.unit,
        room: occ.room,
      });
    }
  };

  const moveOutValidation = useFormValidation();

  const handleSaveDraft = async () => {
    const rules: Record<string, (v: any) => string | null> = {
      tenant_name: () => !form.tenant_name ? "Tenant is required" : null,
      move_out_type: () => !form.move_out_type ? "Move out type is required" : null,
      effective_date: () => !form.effective_date ? "Effective date is required" : null,
    };
    if (!moveOutValidation.validate(form, rules)) return;
    setSaving(true);
    try {
      const selectedOcc = occupancies.find(o => o.room_id === form.room_id && o.tenant_id === form.tenant_id);
      const assetType = selectedOcc?.room_type === "Car Park" ? "Carpark" : "Room";

      const record = {
        tenant_name: form.tenant_name,
        tenant_id: form.tenant_id || null,
        asset_type: assetType,
        building: form.building,
        unit: form.unit,
        room: form.room,
        room_id: form.room_id || null,
        move_out_type: form.move_out_type,
        effective_date: form.effective_date,
        next_status: form.next_status,
        reason: form.reason,
        status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        await supabase.from("move_outs").update(record).eq("id", editingId);
        toast.success("Move-out draft updated");
      } else {
        await supabase.from("move_outs").insert({
          ...record,
          created_by: user?.id,
          history: [{ action: "created", by: user?.email, at: new Date().toISOString() }],
        });
        toast.success("Move-out draft created");
      }
      queryClient.invalidateQueries({ queryKey: ["move_outs"] });
      setShowForm(false);
      setIsDirty(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Confirm & complete move-out
  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const selectedOcc = occupancies.find(o => o.room_id === form.room_id && o.tenant_id === form.tenant_id);
      const assetType = selectedOcc?.room_type === "Car Park" ? "Carpark" : "Room";
      const targetId = editingId;

      let recordId = targetId;
      if (!recordId) {
        const { data: inserted, error: insErr } = await supabase.from("move_outs").insert({
          tenant_name: form.tenant_name,
          tenant_id: form.tenant_id || null,
          asset_type: assetType,
          building: form.building,
          unit: form.unit,
          room: form.room,
          room_id: form.room_id || null,
          move_out_type: form.move_out_type,
          effective_date: form.effective_date,
          next_status: form.next_status,
          reason: form.reason,
          status: "completed",
          created_by: user.id,
          history: [
            { action: "created", by: user.email, at: new Date().toISOString() },
            { action: "completed", by: user.email, at: new Date().toISOString() },
          ],
        }).select("id").single();
        if (insErr) throw insErr;
        recordId = inserted.id;
      } else {
        const existing = moveOuts.find(m => m.id === recordId);
        const hist = [...(existing?.history || []), { action: "completed", by: user.email, at: new Date().toISOString() }];
        await supabase.from("move_outs").update({
          tenant_name: form.tenant_name,
          tenant_id: form.tenant_id || null,
          asset_type: assetType,
          building: form.building,
          unit: form.unit,
          room: form.room,
          room_id: form.room_id || null,
          move_out_type: form.move_out_type,
          effective_date: form.effective_date,
          next_status: form.next_status,
          reason: form.reason,
          status: "completed",
          history: hist,
          updated_at: new Date().toISOString(),
        }).eq("id", recordId);
      }

      // Update room status
      if (form.room_id) {
        await supabase.from("rooms").update({
          status: form.next_status,
          tenant_gender: "",
          tenant_race: "",
          pax_staying: 0,
          tenancy_start_date: null,
          tenancy_end_date: null,
        }).eq("id", form.room_id);
      }

      // Deactivate tenant_rooms bindings
      if (form.room_id && form.tenant_id) {
        await supabase.from("tenant_rooms").update({ status: "moved_out" })
          .eq("room_id", form.room_id)
          .eq("tenant_id", form.tenant_id)
          .eq("status", "active");
      }

      await logActivity("move_out", "room", form.room_id || "", {
        building: form.building,
        unit: form.unit,
        room: form.room,
        tenant_name: form.tenant_name,
        move_out_type: form.move_out_type,
        effective_date: form.effective_date,
        next_status: form.next_status,
        reason: form.reason,
        asset_type: assetType,
        move_out_id: recordId,
      });

      queryClient.invalidateQueries({ queryKey: ["move_outs"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["active_occupancies"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_rooms"] });

      toast.success(`Move-out completed — ${form.building} ${form.unit} ${form.room} → ${form.next_status}`);
      setShowForm(false);
      setShowConfirm(false);
      setIsDirty(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to complete move-out");
    } finally {
      setSaving(false);
    }
  };

  // Cancel a draft
  const handleCancel = async (m: MoveOut) => {
    try {
      const hist = [...(m.history || []), { action: "cancelled", by: user?.email, at: new Date().toISOString() }];
      await supabase.from("move_outs").update({ status: "cancelled", history: hist, updated_at: new Date().toISOString() }).eq("id", m.id);
      queryClient.invalidateQueries({ queryKey: ["move_outs"] });
      toast.success("Move-out cancelled");
      setViewItem(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  if (!isAdmin) {
    return <div className="py-10 text-center text-muted-foreground">Only Admin and Super Admin can access Move Out.</div>;
  }

  const canValidate = form.tenant_name && form.move_out_type && form.effective_date && form.room_id;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Move Out</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage official occupancy release for rooms and carparks.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Move Out</Button>
      </div>

      {/* Filters */}
      <StandardFilterBar
        search={search}
        onSearchChange={v => { setSearch(v); setPage(0); }}
        placeholder="Search tenant, building, unit, room..."
        hasActiveFilters={hasFilters}
        onClearFilters={clearAll}
      >
        <div className="space-y-1.5">
          <label className={lbl}>Move Out Type</label>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MOVE_OUT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Effective From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10 w-[140px]" />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>Effective To</label>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10 w-[140px]" />
        </div>
      </StandardFilterBar>

      {/* Advanced filters */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            {advancedOpen ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            Advanced Filters
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card rounded-xl shadow-sm border border-border p-5 mt-2 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className={lbl}>Building</label>
              <Select value={buildingFilter} onValueChange={v => { setBuildingFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {buildings.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Next Status</label>
              <Select value={nextStatusFilter} onValueChange={v => { setNextStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {NEXT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Record Status</label>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Created From</label>
              <Input type="date" value={createdFrom} onChange={e => { setCreatedFrom(e.target.value); setPage(0); }} className="h-10 w-[140px]" />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Created To</label>
              <Input type="date" value={createdTo} onChange={e => { setCreatedTo(e.target.value); setPage(0); }} className="h-10 w-[140px]" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Table */}
      <StandardTable
        columns={
          <TableRow>
            <SortableTableHead sortKey="effective_date" currentSort={sort} onSort={handleSort}>Effective Date</SortableTableHead>
            <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Room / Carpark</TableHead>
            <SortableTableHead sortKey="move_out_type" currentSort={sort} onSort={handleSort}>Move Out Type</SortableTableHead>
            <TableHead>Next Status</TableHead>
            <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
            <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Created</SortableTableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        }
        isEmpty={paged.length === 0}
        emptyMessage="No move-out records found"
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={v => { setPageSize(v); setPage(0); }}
        isLoading={isLoading}
      >
        {paged.map(m => (
          <TableRow key={m.id} className="hover:bg-muted/30">
            <TableCell className="font-medium">{m.effective_date}</TableCell>
            <TableCell>{m.tenant_name || "—"}</TableCell>
            <TableCell>{m.building}</TableCell>
            <TableCell>{m.unit}</TableCell>
            <TableCell>{m.room}</TableCell>
            <TableCell>{m.move_out_type}</TableCell>
            <TableCell><StatusBadge status={m.next_status} /></TableCell>
            <TableCell><StatusBadge status={m.status.charAt(0).toUpperCase() + m.status.slice(1)} /></TableCell>
            <TableCell className="text-sm text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => setViewItem(m)}><Eye className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}
      </StandardTable>

      {/* View Modal */}
      {viewItem && (
        <StandardModal
          open={Boolean(viewItem)}
          onOpenChange={open => !open && setViewItem(null)}
          title="Move Out Details"
          size="md"
          footer={
            <>
              {viewItem.status === "draft" && (
                <>
                  <Button variant="outline" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</Button>
                  <Button variant="destructive" onClick={() => handleCancel(viewItem)}>Cancel Record</Button>
                </>
              )}
            </>
          }
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Summary</h3>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Move Out ID</span><span className="font-mono text-xs">{viewItem.id.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tenant</span><span className="font-medium">{viewItem.tenant_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Effective Date</span><span className="font-medium">{viewItem.effective_date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Move Out Type</span><span>{viewItem.move_out_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Next Status</span><StatusBadge status={viewItem.next_status} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Record Status</span><StatusBadge status={viewItem.status.charAt(0).toUpperCase() + viewItem.status.slice(1)} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(viewItem.created_at), "dd MMM yyyy, HH:mm")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Last Updated</span><span>{format(new Date(viewItem.updated_at), "dd MMM yyyy, HH:mm")}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Occupancy Target</h3>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span>{viewItem.building}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span>{viewItem.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Room / Carpark</span><span>{viewItem.room}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{viewItem.asset_type}</span></div>
              </div>
            </div>

            {viewItem.reason && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Notes</h3>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">{viewItem.reason}</div>
              </div>
            )}

            {viewItem.history && (viewItem.history as any[]).length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">History</h3>
                <div className="space-y-2">
                  {(viewItem.history as any[]).map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{h.action}</span>
                      <span className="text-muted-foreground">{h.by}</span>
                      <span className="text-muted-foreground">{h.at ? format(new Date(h.at), "dd MMM yyyy, HH:mm") : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </StandardModal>
      )}

      {/* Add/Edit Modal */}
      <StandardModal
        open={showForm}
        onOpenChange={open => !open && setShowForm(false)}
        title={editingId ? "Edit Move Out" : "Add Move Out"}
        size="md"
        isDirty={isDirty}
        footer={
          <>
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving || !form.tenant_name || !form.move_out_type}>
              {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowConfirm(true)}
              disabled={saving || !canValidate}
            >
              Complete Move-Out
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <FormErrorBanner errors={moveOutValidation.errors} />
          {/* Section A: Move Out Target */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Move Out Target</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className={lbl}>Tenant *</label>
                <Select value={form.tenant_id || "none"} onValueChange={v => v !== "none" && handleTenantChange(v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select tenant</SelectItem>
                    {tenantOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tenants with active occupancy found.</p>
                )}
              </div>

              {form.tenant_id && (
                <div className="space-y-1">
                  <label className={lbl}>Room / Carpark to move out *</label>
                  {tenantAssets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active occupancy found for this tenant.</p>
                  ) : (
                    <Select value={form.room_id || "none"} onValueChange={v => v !== "none" && handleAssetSelect(v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select room or carpark" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Select room or carpark</SelectItem>
                        {tenantAssets.map(r => (
                          <SelectItem key={r.room_id} value={r.room_id}>
                            {r.building} · {r.unit} · {r.room} ({r.room_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {form.room_id && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span className="font-medium">{form.building}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span className="font-medium">{form.unit}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Room / Carpark</span><span className="font-medium">{form.room}</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Section B: Move Out Details */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Move Out Details</h3>
            <div className="space-y-3">
              <div className="space-y-1" data-field="effective_date">
                <label className={lbl}>Effective Date *</label>
                <Input type="date" className={fieldClass("", !!moveOutValidation.errors.effective_date)} value={form.effective_date} onChange={e => { updateForm({ effective_date: e.target.value }); moveOutValidation.clearError("effective_date"); }} />
                <FieldError error={moveOutValidation.errors.effective_date} />
              </div>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Move Out Type *</label>
                <Select value={form.move_out_type || "none"} onValueChange={v => v !== "none" && updateForm({ move_out_type: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select type</SelectItem>
                    {MOVE_OUT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Reason / Notes</label>
                <Textarea
                  placeholder="Enter reason or notes..."
                  value={form.reason}
                  onChange={e => updateForm({ reason: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className={lbl}>Next Status *</label>
                <Select value={form.next_status} onValueChange={v => updateForm({ next_status: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEXT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </StandardModal>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={open => !saving && setShowConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Move-Out</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Are you sure you want to complete this move-out?</p>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <div><strong>Tenant:</strong> {form.tenant_name}</div>
                  <div><strong>Property:</strong> {form.building} · {form.unit} · {form.room}</div>
                  <div><strong>Type:</strong> {form.move_out_type}</div>
                  <div><strong>Effective Date:</strong> {form.effective_date}</div>
                  <div><strong>Next Status:</strong> {form.next_status}</div>
                </div>
                <p className="text-destructive font-medium">This will release occupancy, remove tenant binding, and update room status. This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Processing..." : "Confirm Move-Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

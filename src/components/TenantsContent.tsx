import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnits } from "@/hooks/useRooms";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { StandardModal } from "@/components/ui/standard-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButtons } from "@/components/ui/action-buttons";
import { inputClass, labelClass } from "@/lib/ui-constants";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TenantRoom {
  id: string;
  room_id: string;
  move_in_date: string | null;
  contract_months: number;
  status: string;
  room?: {
    id: string;
    room: string;
    building: string;
    unit: string;
    room_type: string;
    status: string;
    rent: number;
  };
}

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  ic_passport: string;
  gender: string;
  race: string;
  nationality: string;
  occupation: string;
  company: string;
  position: string;
  monthly_salary: number;
  emergency_1_name: string;
  emergency_1_phone: string;
  emergency_1_relationship: string;
  emergency_2_name: string;
  emergency_2_phone: string;
  emergency_2_relationship: string;
  car_plate: string;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  doc_passport: any;
  doc_offer_letter: any;
  doc_transfer_slip: any;
  tenant_rooms?: TenantRoom[];
}

function useTenants() {
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, tenant_rooms(*, room:rooms(id, room, building, unit, room_type, status, rent))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tenant[];
    },
  });
}

export function TenantsContent() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const queryClient = useQueryClient();
  const { data: tenants = [], isLoading } = useTenants();
  const { data: units = [] } = useUnits();

  const [search, setSearch] = useState("");
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tenant>>({});
  const [editUploadedFiles, setEditUploadedFiles] = useState<{ passport: File | null; offerLetter: File | null; transferSlip: File | null }>({ passport: null, offerLetter: null, transferSlip: null });
  const [editExistingDocs, setEditExistingDocs] = useState<{ passport: string; offerLetter: string; transferSlip: string }>({ passport: "", offerLetter: "", transferSlip: "" });
  const [editDocRemoveConfirm, setEditDocRemoveConfirm] = useState<"passport" | "offerLetter" | "transferSlip" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Tenant>>({});
  const [addUploadedFiles, setAddUploadedFiles] = useState<{ passport: File | null; offerLetter: File | null; transferSlip: File | null }>({ passport: null, offerLetter: null, transferSlip: null });

  const { sort, handleSort, sortData } = useTableSort("name");

  // Derive filter options
  const nationalities = useMemo(() => Array.from(new Set(tenants.map(t => t.nationality).filter(Boolean))).sort(), [tenants]);
  const genders = useMemo(() => Array.from(new Set(tenants.map(t => t.gender).filter(Boolean))).sort(), [tenants]);
  const buildings = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenants) {
      for (const tr of t.tenant_rooms || []) {
        if (tr.room?.building) set.add(tr.room.building);
      }
    }
    return Array.from(set).sort();
  }, [tenants]);
  const unitNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenants) {
      for (const tr of t.tenant_rooms || []) {
        if (tr.room?.unit) set.add(tr.room.unit);
      }
    }
    return Array.from(set).sort();
  }, [tenants]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = tenants;
    if (selectedNationalities.length) list = list.filter(t => selectedNationalities.includes(t.nationality));
    if (selectedGenders.length) list = list.filter(t => selectedGenders.includes(t.gender));
    if (selectedBuildings.length) list = list.filter(t =>
      (t.tenant_rooms || []).some(tr => tr.room?.building && selectedBuildings.includes(tr.room.building))
    );
    if (selectedUnits.length) list = list.filter(t =>
      (t.tenant_rooms || []).some(tr => tr.room?.unit && selectedUnits.includes(tr.room.unit))
    );
    if (statusFilter !== "all") list = list.filter(t =>
      (t.tenant_rooms || []).some(tr => tr.status === statusFilter)
    );
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(s) ||
        t.phone.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        (t.tenant_rooms || []).some(tr =>
          (tr.room?.building || "").toLowerCase().includes(s) ||
          (tr.room?.unit || "").toLowerCase().includes(s) ||
          (tr.room?.room || "").toLowerCase().includes(s)
        )
      );
    }
    return sortData(list, (t: Tenant, key: string) => {
      const rooms = t.tenant_rooms || [];
      const activeRooms = rooms.filter(r => r.room?.room_type !== "Car Park");
      const map: Record<string, any> = {
        name: t.name,
        phone: t.phone,
        email: t.email,
        nationality: t.nationality,
        gender: t.gender,
        building: activeRooms[0]?.room?.building || "",
        unit: activeRooms[0]?.room?.unit || "",
        room: activeRooms[0]?.room?.room || "",
        status: rooms[0]?.status || "",
      };
      return map[key];
    });
  }, [tenants, selectedNationalities, selectedGenders, selectedBuildings, selectedUnits, statusFilter, search, sort]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasFilters = selectedNationalities.length > 0 || selectedGenders.length > 0 ||
    selectedBuildings.length > 0 || selectedUnits.length > 0 ||
    statusFilter !== "all" || search.trim();

  const clearFilters = () => {
    setSelectedNationalities([]); setSelectedGenders([]);
    setSelectedBuildings([]); setSelectedUnits([]);
    setStatusFilter("all"); setSearch(""); setPage(0);
  };

  // Edit
  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setEditForm({ ...t });
    const docP = Array.isArray(t.doc_passport) && t.doc_passport.length > 0 ? t.doc_passport[0] : "";
    const docO = Array.isArray(t.doc_offer_letter) && t.doc_offer_letter.length > 0 ? t.doc_offer_letter[0] : "";
    const docS = Array.isArray(t.doc_transfer_slip) && t.doc_transfer_slip.length > 0 ? t.doc_transfer_slip[0] : "";
    setEditExistingDocs({ passport: docP, offerLetter: docO, transferSlip: docS });
    setEditUploadedFiles({ passport: null, offerLetter: null, transferSlip: null });
  };
  const setField = (key: keyof Tenant, value: any) => setEditForm(prev => ({ ...prev, [key]: value }));

  const saveTenant = async () => {
    if (!editingTenant) return;
    try {
      const passportPath = editUploadedFiles.passport ? await uploadFile(editUploadedFiles.passport, "passport") : editExistingDocs.passport;
      const offerPath = editUploadedFiles.offerLetter ? await uploadFile(editUploadedFiles.offerLetter, "offer-letter") : editExistingDocs.offerLetter;
      const slipPath = editUploadedFiles.transferSlip ? await uploadFile(editUploadedFiles.transferSlip, "transfer-slip") : editExistingDocs.transferSlip;

      const { error } = await supabase.from("tenants").update({
        name: editForm.name || "",
        phone: editForm.phone || "",
        email: editForm.email || "",
        ic_passport: editForm.ic_passport || "",
        gender: editForm.gender || "",
        nationality: editForm.nationality || "",
        occupation: editForm.occupation || "",
        emergency_1_name: editForm.emergency_1_name || "",
        emergency_1_phone: editForm.emergency_1_phone || "",
        emergency_1_relationship: editForm.emergency_1_relationship || "",
        emergency_2_name: editForm.emergency_2_name || "",
        emergency_2_phone: editForm.emergency_2_phone || "",
        emergency_2_relationship: editForm.emergency_2_relationship || "",
        doc_passport: passportPath ? [passportPath] : [],
        doc_offer_letter: offerPath ? [offerPath] : [],
        doc_transfer_slip: slipPath ? [slipPath] : [],
      }).eq("id", editingTenant.id);
      if (error) throw error;
      toast.success("Tenant updated.");
      setEditingTenant(null);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update tenant");
    }
  };

  // Add
  const openAdd = () => {
    setAddForm({});
    setAddUploadedFiles({ passport: null, offerLetter: null, transferSlip: null });
    setAddingTenant(true);
  };
  const setAddField = (key: keyof Tenant, value: any) => setAddForm(prev => ({ ...prev, [key]: value }));

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const saveNewTenant = async () => {
    if (!addForm.name?.trim()) { toast.error("Name is required"); return; }
    if (!addForm.phone?.trim()) { toast.error("Phone is required"); return; }
    try {
      const passportPath = addUploadedFiles.passport ? await uploadFile(addUploadedFiles.passport, "passport") : "";
      const offerPath = addUploadedFiles.offerLetter ? await uploadFile(addUploadedFiles.offerLetter, "offer-letter") : "";
      const slipPath = addUploadedFiles.transferSlip ? await uploadFile(addUploadedFiles.transferSlip, "transfer-slip") : "";

      const { error } = await supabase.from("tenants").insert({
        name: addForm.name || "",
        phone: addForm.phone || "",
        email: addForm.email || "",
        ic_passport: addForm.ic_passport || "",
        gender: addForm.gender || "",
        nationality: addForm.nationality || "",
        occupation: addForm.occupation || "",
        emergency_1_name: addForm.emergency_1_name || "",
        emergency_1_phone: addForm.emergency_1_phone || "",
        emergency_1_relationship: addForm.emergency_1_relationship || "",
        emergency_2_name: addForm.emergency_2_name || "",
        emergency_2_phone: addForm.emergency_2_phone || "",
        emergency_2_relationship: addForm.emergency_2_relationship || "",
        doc_passport: passportPath ? [passportPath] : [],
        doc_offer_letter: offerPath ? [offerPath] : [],
        doc_transfer_slip: slipPath ? [slipPath] : [],
      } as any);
      if (error) throw error;
      toast.success("Tenant added.");
      setAddingTenant(false);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to add tenant");
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase.from("tenants").delete().eq("id", deleteConfirm);
      if (error) throw error;
      toast.success("Tenant deleted.");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete tenant");
    }
  };

  // Helpers
  const getRooms = (t: Tenant) => (t.tenant_rooms || []).filter(tr => tr.room?.room_type !== "Car Park");
  const getCarparks = (t: Tenant) => (t.tenant_rooms || []).filter(tr => tr.room?.room_type === "Car Park");

  return (
    <StandardPageLayout
      title="Tenants"
      actionLabel={isAdmin ? "Add Tenant" : undefined}
      actionIcon={isAdmin ? <Plus className="h-4 w-4" /> : undefined}
      onAction={isAdmin ? openAdd : undefined}
    >
      <StandardFilterBar
        search={search}
        onSearchChange={v => { setSearch(v); setPage(0); }}
        placeholder="Search by name, phone, email, building, unit, room..."
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <MultiSelectFilter label="Nationality" placeholder="All" options={nationalities} selected={selectedNationalities}
          onApply={v => { setSelectedNationalities(v); setPage(0); }} />
        <MultiSelectFilter label="Gender" placeholder="All" options={genders} selected={selectedGenders}
          onApply={v => { setSelectedGenders(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildings} selected={selectedBuildings}
          onApply={v => { setSelectedBuildings(v); setPage(0); }} />
        <MultiSelectFilter label="Unit" placeholder="All" options={unitNumbers} selected={selectedUnits}
          onApply={v => { setSelectedUnits(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className={labelClass}>Status</label>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </StandardFilterBar>

      <StandardTable
        columns={
          <TableRow className="bg-muted/30">
            <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Tenant Name</SortableTableHead>
            <SortableTableHead sortKey="phone" currentSort={sort} onSort={handleSort}>Phone</SortableTableHead>
            <SortableTableHead sortKey="email" currentSort={sort} onSort={handleSort}>Email</SortableTableHead>
            <SortableTableHead sortKey="nationality" currentSort={sort} onSort={handleSort}>Nationality</SortableTableHead>
            <SortableTableHead sortKey="gender" currentSort={sort} onSort={handleSort}>Gender</SortableTableHead>
            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
            <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
            <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
            <TableHead>Carpark</TableHead>
            <TableHead>Pax</TableHead>
            <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        }
        isEmpty={filtered.length === 0}
        emptyMessage="No tenants found."
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        showCount
        countLabel="tenant(s)"
      >
        {paged.map(t => {
          const rooms = getRooms(t);
          const carparks = getCarparks(t);
          const activeRooms = rooms.filter(r => r.status === "active");
          const status = activeRooms.length > 0 ? "active" : rooms.length > 0 ? rooms[0].status : "—";
          return (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name || "—"}</TableCell>
              <TableCell>{t.phone || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{t.email || "—"}</TableCell>
              <TableCell>{t.nationality || "—"}</TableCell>
              <TableCell>{t.gender || "—"}</TableCell>
              <TableCell>{rooms.map(r => r.room?.building).filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>{rooms.map(r => r.room?.unit).filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>{rooms.map(r => r.room?.room?.replace(/^Room\s+/i, "")).filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>{carparks.map(c => c.room?.room).filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>{rooms.length || "—"}</TableCell>
              <TableCell>
                <Badge variant={status === "active" ? "default" : "secondary"} className={
                  status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""
                }>
                  {status}
                </Badge>
              </TableCell>
              <TableCell>
                <ActionButtons actions={[
                  { type: "view", onClick: () => setViewingTenant(t) },
                  { type: "edit", onClick: () => openEdit(t), show: isAdmin },
                  { type: "delete", onClick: () => setDeleteConfirm(t.id), show: isAdmin },
                ]} />
              </TableCell>
            </TableRow>
          );
        })}
      </StandardTable>

      {/* View Dialog */}
      <StandardModal
        open={!!viewingTenant}
        onOpenChange={() => setViewingTenant(null)}
        title="Tenant Details"
        size="md"
        hideCancel
      >
        {viewingTenant && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
              <div className="grid md:grid-cols-2 gap-3">
                <ViewField label="Full Name" value={viewingTenant.name} />
                <ViewField label="NRIC / Passport No" value={viewingTenant.ic_passport} />
                <ViewField label="Email" value={viewingTenant.email} />
                <ViewField label="Contact No" value={viewingTenant.phone} />
                <ViewField label="Gender" value={viewingTenant.gender} />
                <ViewField label="Nationality" value={viewingTenant.nationality} />
                <ViewField label="Occupation" value={viewingTenant.occupation} />
              </div>
            </div>

            {getRooms(viewingTenant).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🏠 Assigned Rooms</div>
                <div className="space-y-1.5">
                  {getRooms(viewingTenant).map(tr => (
                    <div key={tr.id} className="flex items-center gap-2 text-sm bg-background rounded-lg border px-3 py-2">
                      <span className="font-medium">{tr.room?.building} · {tr.room?.unit} · {tr.room?.room}</span>
                      <span className="text-muted-foreground">RM{tr.room?.rent}</span>
                      <Badge variant={tr.status === "active" ? "default" : "secondary"} className={
                        tr.status === "active" ? "bg-emerald-100 text-emerald-700 text-xs" : "text-xs"
                      }>{tr.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getCarparks(viewingTenant).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🅿️ Assigned Carparks</div>
                <div className="space-y-1.5">
                  {getCarparks(viewingTenant).map(tr => (
                    <div key={tr.id} className="flex items-center gap-2 text-sm bg-background rounded-lg border px-3 py-2">
                      <span className="font-medium">🅿️ {tr.room?.room}</span>
                      <Badge variant={tr.status === "active" ? "default" : "secondary"} className={
                        tr.status === "active" ? "bg-emerald-100 text-emerald-700 text-xs" : "text-xs"
                      }>{tr.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Contact 1</div>
                  <ViewField label="Name" value={viewingTenant.emergency_1_name} />
                  <ViewField label="Phone" value={viewingTenant.emergency_1_phone} />
                  <ViewField label="Relationship" value={viewingTenant.emergency_1_relationship} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Contact 2</div>
                  <ViewField label="Name" value={viewingTenant.emergency_2_name} />
                  <ViewField label="Phone" value={viewingTenant.emergency_2_phone} />
                  <ViewField label="Relationship" value={viewingTenant.emergency_2_relationship} />
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">📎 Documents</div>
              {([
                { label: "Passport / IC", paths: viewingTenant.doc_passport },
                { label: "Offer Letter", paths: viewingTenant.doc_offer_letter },
                { label: "Transfer Slip", paths: viewingTenant.doc_transfer_slip },
              ]).map(({ label, paths }) => {
                const arr = Array.isArray(paths) ? paths : [];
                return (
                  <div key={label} className="space-y-1">
                    <label className={labelClass}>{label}</label>
                    {arr.length > 0 ? (
                      <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                        <span className="text-sm flex-1 truncate">{String(arr[0]).split("/").pop()}</span>
                        <a href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/booking-docs/${arr[0]}`}
                          target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No file uploaded</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </StandardModal>

      {/* Edit Dialog */}
      <StandardModal
        open={!!editingTenant}
        onOpenChange={(open) => { if (!open) setEditingTenant(null); }}
        title="Edit Tenant"
        size="md"
        isDirty={JSON.stringify(editForm) !== JSON.stringify(editingTenant)}
        footer={<Button onClick={saveTenant}>Save Changes</Button>}
      >
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><label className={labelClass}>Full Name</label><Input value={editForm.name || ""} onChange={e => setField("name", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>NRIC / Passport No</label><Input value={editForm.ic_passport || ""} onChange={e => setField("ic_passport", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Email</label><Input value={editForm.email || ""} onChange={e => setField("email", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Contact No</label><Input value={editForm.phone || ""} onChange={e => setField("phone", e.target.value)} /></div>
              <div className="space-y-1">
                <label className={labelClass}>Gender</label>
                <Select value={editForm.gender || ""} onValueChange={v => setField("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Couple">Couple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className={labelClass}>Nationality</label><Input value={editForm.nationality || ""} onChange={e => setField("nationality", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Occupation</label><Input value={editForm.occupation || ""} onChange={e => setField("occupation", e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 1</div>
                <div className="space-y-1"><label className={labelClass}>Name</label><Input value={editForm.emergency_1_name || ""} onChange={e => setField("emergency_1_name", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={editForm.emergency_1_phone || ""} onChange={e => setField("emergency_1_phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={editForm.emergency_1_relationship || ""} onChange={e => setField("emergency_1_relationship", e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 2</div>
                <div className="space-y-1"><label className={labelClass}>Name</label><Input value={editForm.emergency_2_name || ""} onChange={e => setField("emergency_2_name", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={editForm.emergency_2_phone || ""} onChange={e => setField("emergency_2_phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={editForm.emergency_2_relationship || ""} onChange={e => setField("emergency_2_relationship", e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">📎 Documents</div>
            {([
              { key: "passport" as const, label: "Passport / IC" },
              { key: "offerLetter" as const, label: "Offer Letter" },
              { key: "transferSlip" as const, label: "Transfer Slip" },
            ]).map(({ key, label }) => {
              const hasNewFile = editUploadedFiles[key] != null;
              const hasExisting = !!editExistingDocs[key];
              const hasFile = hasNewFile || hasExisting;
              const fileName = hasNewFile ? editUploadedFiles[key]!.name : hasExisting ? editExistingDocs[key].split("/").pop() : null;
              return (
                <div key={key} className="space-y-1">
                  <label className={labelClass}>{label}</label>
                  {hasFile ? (
                    <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                      <span className="text-sm flex-1 truncate">{fileName}</span>
                      <button type="button" onClick={() => setEditDocRemoveConfirm(key)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove file">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                      <span className="text-muted-foreground">Choose File</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setEditUploadedFiles(prev => ({ ...prev, [key]: file }));
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </StandardModal>

      {/* Edit doc remove confirm */}
      <ConfirmDialog
        open={!!editDocRemoveConfirm}
        onOpenChange={(open) => { if (!open) setEditDocRemoveConfirm(null); }}
        title="Remove file?"
        description="Are you sure you want to remove this file?"
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (editDocRemoveConfirm) {
            setEditUploadedFiles(prev => ({ ...prev, [editDocRemoveConfirm]: null }));
            setEditExistingDocs(prev => ({ ...prev, [editDocRemoveConfirm]: "" }));
          }
          setEditDocRemoveConfirm(null);
        }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Delete Tenant"
        description="Are you sure you want to delete this tenant? This action cannot be undone. All room assignments will also be removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Add Tenant Dialog */}
      <StandardModal
        open={addingTenant}
        onOpenChange={(open) => { if (!open) setAddingTenant(false); }}
        title="Add Tenant"
        size="md"
        isDirty={!!addForm.name || !!addForm.phone}
        footer={<Button onClick={saveNewTenant}>Add Tenant</Button>}
      >
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><label className={labelClass}>Full Name *</label><Input value={addForm.name || ""} onChange={e => setAddField("name", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>NRIC / Passport No</label><Input value={addForm.ic_passport || ""} onChange={e => setAddField("ic_passport", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Email</label><Input value={addForm.email || ""} onChange={e => setAddField("email", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Contact No *</label><Input value={addForm.phone || ""} onChange={e => setAddField("phone", e.target.value)} /></div>
              <div className="space-y-1">
                <label className={labelClass}>Gender</label>
                <Select value={addForm.gender || ""} onValueChange={v => setAddField("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Couple">Couple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className={labelClass}>Nationality</label><Input value={addForm.nationality || ""} onChange={e => setAddField("nationality", e.target.value)} /></div>
              <div className="space-y-1"><label className={labelClass}>Occupation</label><Input value={addForm.occupation || ""} onChange={e => setAddField("occupation", e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 1 *</div>
                <div className="space-y-1"><label className={labelClass}>Name</label><Input value={addForm.emergency_1_name || ""} onChange={e => setAddField("emergency_1_name", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={addForm.emergency_1_phone || ""} onChange={e => setAddField("emergency_1_phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={addForm.emergency_1_relationship || ""} onChange={e => setAddField("emergency_1_relationship", e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 2 *</div>
                <div className="space-y-1"><label className={labelClass}>Name</label><Input value={addForm.emergency_2_name || ""} onChange={e => setAddField("emergency_2_name", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={addForm.emergency_2_phone || ""} onChange={e => setAddField("emergency_2_phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={addForm.emergency_2_relationship || ""} onChange={e => setAddField("emergency_2_relationship", e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">📎 Documents</div>
            {([
              { key: "passport" as const, label: "Passport / IC" },
              { key: "offerLetter" as const, label: "Offer Letter" },
              { key: "transferSlip" as const, label: "Transfer Slip" },
            ]).map(({ key, label }) => {
              const hasFile = addUploadedFiles[key] != null;
              return (
                <div key={key} className="space-y-1">
                  <label className={labelClass}>{label}</label>
                  {hasFile ? (
                    <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                      <span className="text-sm flex-1 truncate">{addUploadedFiles[key]!.name}</span>
                      <button type="button" onClick={() => setAddUploadedFiles(prev => ({ ...prev, [key]: null }))}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove file">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                      <span className="text-muted-foreground">Choose File</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setAddUploadedFiles(prev => ({ ...prev, [key]: file }));
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </StandardModal>
    </StandardPageLayout>
  );
}

function ViewField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm px-3 py-2 rounded-lg bg-background border">{value || "—"}</div>
    </div>
  );
}

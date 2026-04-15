import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Plus, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { StandardModal } from "@/components/ui/standard-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButtons } from "@/components/ui/action-buttons";
import { inputClass, labelClass } from "@/lib/ui-constants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

// ─── Types ───

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
    parking_lot?: string;
  };
}

interface Booking {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  status: string;
  move_in_date: string;
  contract_months: number;
  created_at: string;
  room_id: string | null;
  unit_id: string | null;
  parking: string;
  room?: { room: string; building: string; unit: string; room_type: string; rent: number } | null;
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
  // computed
  _activeRooms?: number;
  _activeCarparks?: number;
  _totalBookings?: number;
}

// ─── Data hooks ───

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

function useBookingsForTenant(tenantName: string, tenantPhone: string) {
  return useQuery({
    queryKey: ["tenant-bookings", tenantName, tenantPhone],
    queryFn: async () => {
      if (!tenantName) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("id, tenant_name, tenant_phone, status, move_in_date, contract_months, created_at, room_id, unit_id, parking, room:rooms(room, building, unit, room_type, rent)")
        .eq("tenant_name", tenantName)
        .eq("tenant_phone", tenantPhone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Booking[];
    },
    enabled: !!tenantName,
  });
}

// Count bookings for all tenants (lightweight)
function useBookingCounts() {
  return useQuery({
    queryKey: ["tenant-booking-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("tenant_name, tenant_phone");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const b of data || []) {
        const key = `${b.tenant_name}|||${b.tenant_phone}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    },
  });
}

// ─── Helpers ───

const getRooms = (t: Tenant) => (t.tenant_rooms || []).filter(tr => tr.room?.room_type !== "Car Park");
const getCarparks = (t: Tenant) => (t.tenant_rooms || []).filter(tr => tr.room?.room_type === "Car Park");
const getActiveRooms = (t: Tenant) => getRooms(t).filter(tr => tr.status === "active");
const getActiveCarparks = (t: Tenant) => getCarparks(t).filter(tr => tr.status === "active");

function ViewField({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || "N/A"}</div>
    </div>
  );
}

// ─── Main Component ───

export function TenantsContent() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const queryClient = useQueryClient();
  const { data: tenants = [], isLoading } = useTenants();
  const { data: bookingCounts = {} } = useBookingCounts();

  // Filters
  const [search, setSearch] = useState("");
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [occupationFilter, setOccupationFilter] = useState("");
  const [hasActiveRooms, setHasActiveRooms] = useState("");
  const [hasActiveCarparks, setHasActiveCarparks] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);

  // Modal state
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tenant>>({});
  const [editUploadedFiles, setEditUploadedFiles] = useState<{ passport: File | null; offerLetter: File | null }>({ passport: null, offerLetter: null });
  const [editExistingDocs, setEditExistingDocs] = useState<{ passport: string; offerLetter: string }>({ passport: "", offerLetter: "" });
  const [editDocRemoveConfirm, setEditDocRemoveConfirm] = useState<"passport" | "offerLetter" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const [addForm, setAddForm] = useState<Partial<Tenant>>({});
  const [addUploadedFiles, setAddUploadedFiles] = useState<{ passport: File | null; offerLetter: File | null }>({ passport: null, offerLetter: null });

  const { sort, handleSort, sortData } = useTableSort("name");

  // Filter options
  const nationalities = useMemo(() => Array.from(new Set(tenants.map(t => t.nationality).filter(Boolean))).sort(), [tenants]);
  const genders = useMemo(() => Array.from(new Set(tenants.map(t => t.gender).filter(Boolean))).sort(), [tenants]);
  const buildings = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenants) for (const tr of t.tenant_rooms || []) if (tr.room?.building) set.add(tr.room.building);
    return Array.from(set).sort();
  }, [tenants]);
  const occupations = useMemo(() => Array.from(new Set(tenants.map(t => t.occupation).filter(Boolean))).sort(), [tenants]);

  // Enrich tenants with computed counts
  const enriched = useMemo(() => tenants.map(t => ({
    ...t,
    _activeRooms: getActiveRooms(t).length,
    _activeCarparks: getActiveCarparks(t).length,
    _totalBookings: bookingCounts[`${t.name}|||${t.phone}`] || 0,
  })), [tenants, bookingCounts]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = enriched;
    if (selectedNationalities.length) list = list.filter(t => selectedNationalities.includes(t.nationality));
    if (selectedGenders.length) list = list.filter(t => selectedGenders.includes(t.gender));
    if (selectedBuildings.length) list = list.filter(t =>
      (t.tenant_rooms || []).some(tr => tr.room?.building && selectedBuildings.includes(tr.room.building))
    );
    if (occupationFilter) list = list.filter(t => t.occupation === occupationFilter);
    if (hasActiveRooms === "yes") list = list.filter(t => t._activeRooms! > 0);
    if (hasActiveRooms === "no") list = list.filter(t => t._activeRooms === 0);
    if (hasActiveCarparks === "yes") list = list.filter(t => t._activeCarparks! > 0);
    if (hasActiveCarparks === "no") list = list.filter(t => t._activeCarparks === 0);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(s) ||
        t.phone.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s)
      );
    }
    return sortData(list, (t: Tenant, key: string) => {
      const map: Record<string, any> = {
        name: t.name,
        phone: t.phone,
        email: t.email,
        gender: t.gender,
        nationality: t.nationality,
        occupation: t.occupation,
        active_rooms: t._activeRooms,
        active_carparks: t._activeCarparks,
        total_bookings: t._totalBookings,
      };
      return map[key];
    });
  }, [enriched, selectedNationalities, selectedGenders, selectedBuildings, occupationFilter, hasActiveRooms, hasActiveCarparks, search, sort]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasFilters = selectedNationalities.length > 0 || selectedGenders.length > 0 ||
    selectedBuildings.length > 0 || !!occupationFilter || !!hasActiveRooms || !!hasActiveCarparks || search.trim() !== "";

  const clearFilters = () => {
    setSelectedNationalities([]); setSelectedGenders([]);
    setSelectedBuildings([]); setOccupationFilter("");
    setHasActiveRooms(""); setHasActiveCarparks("");
    setSearch(""); setPage(0);
  };

  // ── CRUD helpers ──
  const addValidation = useFormValidation();
  const editValidation = useFormValidation();

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setEditForm({ ...t });
    const docP = Array.isArray(t.doc_passport) && t.doc_passport.length > 0 ? t.doc_passport[0] : "";
    const docO = Array.isArray(t.doc_offer_letter) && t.doc_offer_letter.length > 0 ? t.doc_offer_letter[0] : "";
    setEditExistingDocs({ passport: docP, offerLetter: docO });
    setEditUploadedFiles({ passport: null, offerLetter: null });
    editValidation.clearAllErrors();
  };
  const setField = (key: keyof Tenant, value: any) => setEditForm(prev => ({ ...prev, [key]: value }));

  const saveTenant = async () => {
    if (!editingTenant) return;
    const rules = {
      name: (v: any) => !editForm.name?.trim() ? "Full Name is required" : null,
      phone: (v: any) => !editForm.phone?.trim() ? "Contact number is required" : null,
    };
    if (!editValidation.validate(editForm, rules)) return;
    try {
      const passportPath = editUploadedFiles.passport ? await uploadFile(editUploadedFiles.passport, "passport") : editExistingDocs.passport;
      const offerPath = editUploadedFiles.offerLetter ? await uploadFile(editUploadedFiles.offerLetter, "offer-letter") : editExistingDocs.offerLetter;

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
      }).eq("id", editingTenant.id);
      if (error) throw error;
      toast.success("Tenant updated.");
      setEditingTenant(null);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update tenant");
    }
  };

  const openAdd = () => {
    setAddForm({});
    setAddUploadedFiles({ passport: null, offerLetter: null });
    addValidation.clearAllErrors();
    setAddingTenant(true);
  };
  const setAddField = (key: keyof Tenant, value: any) => setAddForm(prev => ({ ...prev, [key]: value }));

  const saveNewTenant = async () => {
    const rules = {
      name: (v: any) => !addForm.name?.trim() ? "Full Name is required" : null,
      phone: (v: any) => !addForm.phone?.trim() ? "Contact number is required" : null,
    };
    if (!addValidation.validate(addForm, rules)) return;
    try {
      const passportPath = addUploadedFiles.passport ? await uploadFile(addUploadedFiles.passport, "passport") : "";
      const offerPath = addUploadedFiles.offerLetter ? await uploadFile(addUploadedFiles.offerLetter, "offer-letter") : "";

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
      } as any);
      if (error) throw error;
      toast.success("Tenant added.");
      setAddingTenant(false);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to add tenant");
    }
  };

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

  return (
    <StandardPageLayout
      title="Tenants"
      actionLabel={isAdmin ? "Add Tenant" : undefined}
      actionIcon={isAdmin ? <Plus className="h-4 w-4" /> : undefined}
      onAction={isAdmin ? openAdd : undefined}
    >
      {/* ── Filters ── */}
      <StandardFilterBar
        search={search}
        onSearchChange={v => { setSearch(v); setPage(0); }}
        placeholder="Search by name, email, phone..."
        hasActiveFilters={!!hasFilters}
        onClearFilters={clearFilters}
      >
        <MultiSelectFilter label="Nationality" placeholder="All" options={nationalities} selected={selectedNationalities}
          onApply={v => { setSelectedNationalities(v); setPage(0); }} />
        <MultiSelectFilter label="Gender" placeholder="All" options={genders} selected={selectedGenders}
          onApply={v => { setSelectedGenders(v); setPage(0); }} />
        <Button variant="outline" size="sm" onClick={() => setShowAdvanced(v => !v)} className="text-sm self-end">
          {showAdvanced ? "Hide" : "Show"} Advanced
        </Button>
        {showAdvanced && (
          <>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Occupation</label>
              <select className={inputClass} value={occupationFilter} onChange={e => { setOccupationFilter(e.target.value); setPage(0); }}>
                <option value="">All</option>
                {occupations.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Has Active Rooms</label>
              <select className={inputClass} value={hasActiveRooms} onChange={e => { setHasActiveRooms(e.target.value); setPage(0); }}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Has Active Carparks</label>
              <select className={inputClass} value={hasActiveCarparks} onChange={e => { setHasActiveCarparks(e.target.value); setPage(0); }}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <MultiSelectFilter label="Building" placeholder="All" options={buildings} selected={selectedBuildings}
              onApply={v => { setSelectedBuildings(v); setPage(0); }} />
          </>
        )}
      </StandardFilterBar>

      {/* ── Table ── */}
      <StandardTable
        columns={
        <TableRow className="bg-muted/30">
            <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Tenant Name</SortableTableHead>
            <SortableTableHead sortKey="phone" currentSort={sort} onSort={handleSort}>Phone Number</SortableTableHead>
            <SortableTableHead sortKey="email" currentSort={sort} onSort={handleSort}>Email Address</SortableTableHead>
            <SortableTableHead sortKey="nationality" currentSort={sort} onSort={handleSort}>Nationality</SortableTableHead>
            <SortableTableHead sortKey="active_rooms" currentSort={sort} onSort={handleSort} className="text-center">Active Rooms</SortableTableHead>
            <SortableTableHead sortKey="active_carparks" currentSort={sort} onSort={handleSort} className="text-center">Active Carparks</SortableTableHead>
            <TableHead className="text-center">Actions</TableHead>
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
        {paged.map(t => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.name || "N/A"}</TableCell>
            <TableCell>{t.phone || "N/A"}</TableCell>
            <TableCell>{t.email || "N/A"}</TableCell>
            <TableCell>{t.nationality || "N/A"}</TableCell>
            <TableCell className="text-center">
              <span className={t._activeRooms! > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{t._activeRooms}</span>
            </TableCell>
            <TableCell className="text-center">
              <span className={t._activeCarparks! > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{t._activeCarparks}</span>
            </TableCell>
            <TableCell className="text-center">
              <ActionButtons actions={[
                { type: "view", onClick: () => setViewingTenant(t) },
                { type: "edit", onClick: () => openEdit(t), show: isAdmin },
                { type: "delete", onClick: () => setDeleteConfirm(t.id), show: isAdmin },
              ]} />
            </TableCell>
          </TableRow>
        ))}
      </StandardTable>

      {/* ── View Tenant Detail Modal ── */}
      <StandardModal
        open={!!viewingTenant}
        onOpenChange={() => setViewingTenant(null)}
        title={`Tenant — ${viewingTenant?.name || ""}`}
        size="lg"
        hideCancel
        footer={<Button variant="outline" onClick={() => setViewingTenant(null)}>Close</Button>}
      >
        {viewingTenant && <TenantDetailView tenant={viewingTenant} isAdmin={isAdmin} />}
      </StandardModal>

      {/* ── Edit Dialog ── */}
      <StandardModal
        open={!!editingTenant}
        onOpenChange={(open) => { if (!open) setEditingTenant(null); }}
        title="Edit Tenant"
        size="md"
        isDirty={JSON.stringify(editForm) !== JSON.stringify(editingTenant)}
        footer={<Button onClick={saveTenant}>Save</Button>}
      >
        <TenantForm form={editForm} setField={setField} uploadedFiles={editUploadedFiles} setUploadedFiles={setEditUploadedFiles}
          existingDocs={editExistingDocs} onRemoveDoc={setEditDocRemoveConfirm as any} errors={editValidation.errors} clearError={editValidation.clearError} />
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

      {/* ── Add Tenant Dialog ── */}
      <StandardModal
        open={addingTenant}
        onOpenChange={(open) => { if (!open) setAddingTenant(false); }}
        title="Add Tenant"
        size="md"
        isDirty={!!addForm.name || !!addForm.phone}
        footer={<Button onClick={saveNewTenant}>Save</Button>}
      >
        <TenantForm form={addForm} setField={setAddField} uploadedFiles={addUploadedFiles} setUploadedFiles={setAddUploadedFiles}
          existingDocs={{ passport: "", offerLetter: "" }} errors={addValidation.errors} clearError={addValidation.clearError} />
      </StandardModal>
    </StandardPageLayout>
  );
}

// ─── Tenant Form (shared by Add & Edit) ───

function TenantForm({ form, setField, uploadedFiles, setUploadedFiles, existingDocs, onRemoveDoc, errors, clearError }: {
  form: Partial<Tenant>;
  setField: (key: keyof Tenant, value: any) => void;
  uploadedFiles: { passport: File | null; offerLetter: File | null };
  setUploadedFiles: React.Dispatch<React.SetStateAction<{ passport: File | null; offerLetter: File | null }>>;
  existingDocs: { passport: string; offerLetter: string };
  onRemoveDoc?: (key: "passport" | "offerLetter") => void;
  errors?: Record<string, string>;
  clearError?: (field: string) => void;
}) {
  const renderFileField = (key: "passport" | "offerLetter", label: string) => {
    const hasNewFile = uploadedFiles[key] != null;
    const hasExisting = !!existingDocs[key];
    const hasFile = hasNewFile || hasExisting;
    const fileName = hasNewFile ? uploadedFiles[key]!.name : hasExisting ? existingDocs[key].split("/").pop() : null;
    return (
      <div key={key} className="space-y-1">
        <label className={labelClass}>{label}</label>
        {hasFile ? (
          <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
            <span className="text-sm flex-1 truncate">{fileName}</span>
            {onRemoveDoc && (
              <button type="button" onClick={() => onRemoveDoc(key)}
                className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" title="Remove file">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
            <span className="text-muted-foreground">Choose File</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) setUploadedFiles(prev => ({ ...prev, [key]: file }));
              e.target.value = "";
            }} />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {errors && <FormErrorBanner errors={errors} />}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1" data-field="name"><label className={labelClass}>Full Name *</label><Input className={fieldClass("", !!errors?.name)} value={form.name || ""} onChange={e => { setField("name", e.target.value); clearError?.("name"); }} /><FieldError error={errors?.name} /></div>
          <div className="space-y-1"><label className={labelClass}>NRIC / Passport No</label><Input value={form.ic_passport || ""} onChange={e => setField("ic_passport", e.target.value)} /></div>
          <div className="space-y-1"><label className={labelClass}>Email</label><Input value={form.email || ""} onChange={e => setField("email", e.target.value)} /></div>
          <div className="space-y-1" data-field="phone"><label className={labelClass}>Contact No *</label><Input className={fieldClass("", !!errors?.phone)} value={form.phone || ""} onChange={e => { setField("phone", e.target.value); clearError?.("phone"); }} /><FieldError error={errors?.phone} /></div>
          <div className="space-y-1">
            <label className={labelClass}>Gender</label>
            <Select value={form.gender || ""} onValueChange={v => setField("gender", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Couple">Couple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><label className={labelClass}>Nationality</label><Input value={form.nationality || ""} onChange={e => setField("nationality", e.target.value)} /></div>
          <div className="space-y-1"><label className={labelClass}>Occupation</label><Input value={form.occupation || ""} onChange={e => setField("occupation", e.target.value)} /></div>
        </div>
        {/* Document uploads at end of Personal Info */}
        <div className="grid md:grid-cols-2 gap-3 pt-2">
          {renderFileField("passport", "Passport / IC")}
          {renderFileField("offerLetter", "Offer Letter")}
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Contact 1</div>
            <div className="space-y-1"><label className={labelClass}>Name</label><Input value={form.emergency_1_name || ""} onChange={e => setField("emergency_1_name", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={form.emergency_1_phone || ""} onChange={e => setField("emergency_1_phone", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={form.emergency_1_relationship || ""} onChange={e => setField("emergency_1_relationship", e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Contact 2</div>
            <div className="space-y-1"><label className={labelClass}>Name</label><Input value={form.emergency_2_name || ""} onChange={e => setField("emergency_2_name", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Phone</label><Input value={form.emergency_2_phone || ""} onChange={e => setField("emergency_2_phone", e.target.value)} /></div>
            <div className="space-y-1"><label className={labelClass}>Relationship</label><Input value={form.emergency_2_relationship || ""} onChange={e => setField("emergency_2_relationship", e.target.value)} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Detail View ───

function TenantDetailView({ tenant, isAdmin }: { tenant: Tenant; isAdmin: boolean }) {
  const { data: bookings = [], isLoading: bookingsLoading } = useBookingsForTenant(tenant.name, tenant.phone);
  const rooms = getRooms(tenant);
  const carparks = getCarparks(tenant);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={["personal", "emergency", "occupancy", "bookings"]} className="space-y-2">
        {/* Personal Info */}
        <AccordionItem value="personal" className="border rounded-lg px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <span className="text-sm font-semibold">👤 Personal Info</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid md:grid-cols-2 gap-3 pb-2">
              <ViewField label="Full Name" value={tenant.name} />
              <ViewField label="NRIC / Passport No" value={tenant.ic_passport} />
              <ViewField label="Email" value={tenant.email} />
              <ViewField label="Contact No" value={tenant.phone} />
              <ViewField label="Gender" value={tenant.gender} />
              <ViewField label="Nationality" value={tenant.nationality} />
              <ViewField label="Occupation" value={tenant.occupation} />
            </div>
            {/* Documents inline */}
            <div className="grid md:grid-cols-2 gap-3 pt-2 pb-2">
              {([
                { label: "Passport / IC", paths: tenant.doc_passport },
                { label: "Offer Letter", paths: tenant.doc_offer_letter },
              ]).map(({ label, paths }) => {
                const arr = Array.isArray(paths) ? paths : [];
                return (
                  <div key={label} className="space-y-1">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    {arr.length > 0 ? (
                      <div className="flex items-center gap-2 bg-muted/30 rounded-lg border px-3 py-2">
                        <span className="text-sm flex-1 truncate">{String(arr[0]).split("/").pop()}</span>
                        <a href={`${supabaseUrl}/storage/v1/object/public/booking-docs/${arr[0]}`}
                          target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No file uploaded</div>
                    )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Emergency Contacts */}
        <AccordionItem value="emergency" className="border rounded-lg px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <span className="text-sm font-semibold">🚨 Emergency Contacts</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid md:grid-cols-2 gap-4 pb-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 1</div>
                <ViewField label="Name" value={tenant.emergency_1_name} />
                <ViewField label="Phone" value={tenant.emergency_1_phone} />
                <ViewField label="Relationship" value={tenant.emergency_1_relationship} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Contact 2</div>
                <ViewField label="Name" value={tenant.emergency_2_name} />
                <ViewField label="Phone" value={tenant.emergency_2_phone} />
                <ViewField label="Relationship" value={tenant.emergency_2_relationship} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Current Occupancy */}
        <AccordionItem value="occupancy" className="border rounded-lg px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🏠 Current Occupancy</span>
              <span className="text-xs text-muted-foreground">— {rooms.length} rooms, {carparks.length} carparks</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              {/* Rooms */}
              {rooms.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rooms</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Building</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead className="text-right">Current Rental</TableHead>
                          <TableHead>Move-in Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rooms.map(tr => (
                          <TableRow key={tr.id}>
                            <TableCell className="font-medium">{tr.room?.building || "N/A"}</TableCell>
                            <TableCell>{tr.room?.unit || "N/A"}</TableCell>
                            <TableCell>{tr.room?.room?.replace(/^Room\s+/i, "") || "N/A"}</TableCell>
                            <TableCell className="text-right">RM{tr.room?.rent || 0}</TableCell>
                            <TableCell>{tr.move_in_date || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant={tr.status === "active" ? "default" : "secondary"}
                                className={tr.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs" : "text-xs"}>
                                {tr.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No rooms assigned.</p>
              )}

              {/* Carparks */}
              {carparks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carparks</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Building</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Lot</TableHead>
                          <TableHead className="text-right">Rental</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carparks.map(tr => (
                          <TableRow key={tr.id}>
                            <TableCell className="font-medium">{tr.room?.building || "N/A"}</TableCell>
                            <TableCell>{tr.room?.unit || "N/A"}</TableCell>
                            <TableCell>🅿️ {tr.room?.room || "N/A"}</TableCell>
                            <TableCell className="text-right">RM{tr.room?.rent || 0}</TableCell>
                            <TableCell>
                              <Badge variant={tr.status === "active" ? "default" : "secondary"}
                                className={tr.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs" : "text-xs"}>
                                {tr.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Booking History */}
        <AccordionItem value="bookings" className="border rounded-lg px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">📋 Booking History</span>
              <span className="text-xs text-muted-foreground">— {bookings.length} bookings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {bookingsLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center animate-pulse">Loading bookings…</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No booking history found.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building / Unit / Room</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Rental</TableHead>
                      <TableHead>Move-in Date</TableHead>
                      <TableHead className="text-center">Duration</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => {
                      const room = b.room;
                      const location = room ? `${room.building} · ${room.unit} · ${room.room?.replace(/^Room\s+/i, "")}` : "—";
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium text-xs">{location}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={
                              b.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs" :
                              b.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs" :
                              b.status === "submitted" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs" :
                              "text-xs"
                            }>
                              {b.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">RM{room?.rent || 0}</TableCell>
                          <TableCell>{b.move_in_date || "N/A"}</TableCell>
                          <TableCell className="text-center">{b.contract_months || 12} months</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

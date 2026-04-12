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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronLeft, ChevronRight, Search, X, Eye, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

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
  const isAdmin = role === "admin" || role === "boss" || role === "manager";
  const queryClient = useQueryClient();
  const { data: tenants = [], isLoading } = useTenants();
  const { data: units = [] } = useUnits();

  const [search, setSearch] = useState("");
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const hasFilters = selectedNationalities.length > 0 || selectedGenders.length > 0 ||
    selectedBuildings.length > 0 || selectedUnits.length > 0 ||
    statusFilter !== "all" || search.trim();

  const clearFilters = () => {
    setSelectedNationalities([]); setSelectedGenders([]);
    setSelectedBuildings([]); setSelectedUnits([]);
    setStatusFilter("all"); setSearch(""); setPage(1);
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
      const { error } = await supabase.from("tenants").update({
        name: editForm.name || "",
        phone: editForm.phone || "",
        email: editForm.email || "",
        ic_passport: editForm.ic_passport || "",
        gender: editForm.gender || "",
        nationality: editForm.nationality || "",
        occupation: editForm.occupation || "",
        company: editForm.company || "",
        position: editForm.position || "",
        monthly_salary: editForm.monthly_salary || 0,
        emergency_1_name: editForm.emergency_1_name || "",
        emergency_1_phone: editForm.emergency_1_phone || "",
        emergency_1_relationship: editForm.emergency_1_relationship || "",
        emergency_2_name: editForm.emergency_2_name || "",
        emergency_2_phone: editForm.emergency_2_phone || "",
        emergency_2_relationship: editForm.emergency_2_relationship || "",
        car_plate: editForm.car_plate || "",
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
      const passportPaths = await Promise.all(addUploadedFiles.passport.map(f => uploadFile(f, "passport")));
      const offerPaths = await Promise.all(addUploadedFiles.offerLetter.map(f => uploadFile(f, "offer-letter")));
      const slipPaths = await Promise.all(addUploadedFiles.transferSlip.map(f => uploadFile(f, "transfer-slip")));

      const { error } = await supabase.from("tenants").insert({
        name: addForm.name || "",
        phone: addForm.phone || "",
        email: addForm.email || "",
        ic_passport: addForm.ic_passport || "",
        gender: addForm.gender || "",
        nationality: addForm.nationality || "",
        occupation: addForm.occupation || "",
        company: addForm.company || "",
        position: addForm.position || "",
        monthly_salary: addForm.monthly_salary || 0,
        emergency_1_name: addForm.emergency_1_name || "",
        emergency_1_phone: addForm.emergency_1_phone || "",
        emergency_1_relationship: addForm.emergency_1_relationship || "",
        emergency_2_name: addForm.emergency_2_name || "",
        emergency_2_phone: addForm.emergency_2_phone || "",
        emergency_2_relationship: addForm.emergency_2_relationship || "",
        car_plate: addForm.car_plate || "",
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
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
  const getPax = (t: Tenant) => getRooms(t).length;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Tenants</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtered.length} tenant(s)</span>
          {isAdmin && (
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Tenant</Button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, email, building, unit, room..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className={`${inputClass} w-full pl-10`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <MultiSelectFilter label="Nationality" placeholder="All" options={nationalities} selected={selectedNationalities}
            onApply={v => { setSelectedNationalities(v); setPage(1); }} />
          <MultiSelectFilter label="Gender" placeholder="All" options={genders} selected={selectedGenders}
            onApply={v => { setSelectedGenders(v); setPage(1); }} />
          <MultiSelectFilter label="Building" placeholder="All" options={buildings} selected={selectedBuildings}
            onApply={v => { setSelectedBuildings(v); setPage(1); }} />
          <MultiSelectFilter label="Unit" placeholder="All" options={unitNumbers} selected={selectedUnits}
            onApply={v => { setSelectedUnits(v); setPage(1); }} />

          <div className="space-y-1.5">
            <label className={lbl}>Status</label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-muted-foreground">No tenants found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
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
                </TableHeader>
                <TableBody>
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
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewingTenant(t)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(t)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteConfirm(t.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingTenant} onOpenChange={() => setViewingTenant(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tenant Details</DialogTitle>
          </DialogHeader>
          {viewingTenant && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                <div>
                  <div className="text-lg font-semibold">{viewingTenant.name}</div>
                  <div className="text-sm text-muted-foreground">{viewingTenant.email || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoField label="Phone" value={viewingTenant.phone} />
                  <InfoField label="IC/Passport" value={viewingTenant.ic_passport} />
                  <InfoField label="Gender" value={viewingTenant.gender} />
                  <InfoField label="Nationality" value={viewingTenant.nationality} />
                  <InfoField label="Occupation" value={viewingTenant.occupation} />
                  <InfoField label="Company" value={viewingTenant.company} />
                  <InfoField label="Position" value={viewingTenant.position} />
                  <InfoField label="Monthly Salary" value={viewingTenant.monthly_salary ? `RM${viewingTenant.monthly_salary}` : "—"} />
                  <InfoField label="Car Plate" value={viewingTenant.car_plate} />
                </div>

                {/* Assigned Rooms */}
                {getRooms(viewingTenant).length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-semibold mb-2">Assigned Rooms</div>
                    <div className="space-y-1.5">
                      {getRooms(viewingTenant).map(tr => (
                        <div key={tr.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
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

                {/* Assigned Carparks */}
                {getCarparks(viewingTenant).length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-sm font-semibold mb-2">Assigned Carparks</div>
                    <div className="space-y-1.5">
                      {getCarparks(viewingTenant).map(tr => (
                        <div key={tr.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                          <span className="font-medium">🅿️ {tr.room?.room}</span>
                          <Badge variant={tr.status === "active" ? "default" : "secondary"} className={
                            tr.status === "active" ? "bg-emerald-100 text-emerald-700 text-xs" : "text-xs"
                          }>{tr.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emergency Contacts */}
                <div className="border-t pt-3">
                  <div className="text-sm font-semibold mb-2">Emergency Contacts</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="font-medium">{viewingTenant.emergency_1_name || "—"}</div>
                      <div className="text-muted-foreground">{viewingTenant.emergency_1_phone || "—"}</div>
                      <div className="text-muted-foreground">{viewingTenant.emergency_1_relationship || "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium">{viewingTenant.emergency_2_name || "—"}</div>
                      <div className="text-muted-foreground">{viewingTenant.emergency_2_phone || "—"}</div>
                      <div className="text-muted-foreground">{viewingTenant.emergency_2_relationship || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTenant} onOpenChange={(open) => { if (!open) setEditingTenant(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={lbl}>Full Name</label><Input value={editForm.name || ""} onChange={e => setField("name", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>NRIC / Passport No</label><Input value={editForm.ic_passport || ""} onChange={e => setField("ic_passport", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Email</label><Input value={editForm.email || ""} onChange={e => setField("email", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact No</label><Input value={editForm.phone || ""} onChange={e => setField("phone", e.target.value)} /></div>
                  <div className="space-y-1">
                    <label className={lbl}>Gender</label>
                    <Select value={editForm.gender || ""} onValueChange={v => setField("gender", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Couple">Couple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><label className={lbl}>Nationality</label><Input value={editForm.nationality || ""} onChange={e => setField("nationality", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Occupation</label><Input value={editForm.occupation || ""} onChange={e => setField("occupation", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Company</label><Input value={editForm.company || ""} onChange={e => setField("company", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Position</label><Input value={editForm.position || ""} onChange={e => setField("position", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Monthly Salary</label><Input type="number" value={editForm.monthly_salary || ""} onChange={e => setField("monthly_salary", Number(e.target.value))} /></div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 1</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><Input value={editForm.emergency_1_name || ""} onChange={e => setField("emergency_1_name", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><Input value={editForm.emergency_1_phone || ""} onChange={e => setField("emergency_1_phone", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><Input value={editForm.emergency_1_relationship || ""} onChange={e => setField("emergency_1_relationship", e.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 2</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><Input value={editForm.emergency_2_name || ""} onChange={e => setField("emergency_2_name", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><Input value={editForm.emergency_2_phone || ""} onChange={e => setField("emergency_2_phone", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><Input value={editForm.emergency_2_relationship || ""} onChange={e => setField("emergency_2_relationship", e.target.value)} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditingTenant(null)}>Cancel</Button>
            <Button onClick={saveTenant}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tenant? This action cannot be undone. All room assignments will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tenant Dialog */}
      <Dialog open={addingTenant} onOpenChange={(open) => { if (!open) setAddingTenant(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Add Tenant</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <div className="space-y-4 py-4">
              {/* Personal Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">👤 Personal Info</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={lbl}>Full Name *</label><Input value={addForm.name || ""} onChange={e => setAddField("name", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>NRIC / Passport No</label><Input value={addForm.ic_passport || ""} onChange={e => setAddField("ic_passport", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Email</label><Input value={addForm.email || ""} onChange={e => setAddField("email", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact No *</label><Input value={addForm.phone || ""} onChange={e => setAddField("phone", e.target.value)} /></div>
                  <div className="space-y-1">
                    <label className={lbl}>Gender</label>
                    <Select value={addForm.gender || ""} onValueChange={v => setAddField("gender", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Couple">Couple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><label className={lbl}>Nationality</label><Input value={addForm.nationality || ""} onChange={e => setAddField("nationality", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Occupation</label><Input value={addForm.occupation || ""} onChange={e => setAddField("occupation", e.target.value)} /></div>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">🚨 Emergency Contacts</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 1 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><Input value={addForm.emergency_1_name || ""} onChange={e => setAddField("emergency_1_name", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><Input value={addForm.emergency_1_phone || ""} onChange={e => setAddField("emergency_1_phone", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><Input value={addForm.emergency_1_relationship || ""} onChange={e => setAddField("emergency_1_relationship", e.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Contact 2 *</div>
                    <div className="space-y-1"><label className={lbl}>Name</label><Input value={addForm.emergency_2_name || ""} onChange={e => setAddField("emergency_2_name", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Phone</label><Input value={addForm.emergency_2_phone || ""} onChange={e => setAddField("emergency_2_phone", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Relationship</label><Input value={addForm.emergency_2_relationship || ""} onChange={e => setAddField("emergency_2_relationship", e.target.value)} /></div>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="text-base font-bold flex items-center gap-2 border-b border-border pb-2">📎 Documents</div>
                {([
                  { key: "passport" as const, label: "Passport / IC" },
                  { key: "offerLetter" as const, label: "Offer Letter" },
                  { key: "transferSlip" as const, label: "Transfer Slip" },
                ]).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className={lbl}>{label}</label>
                    <div className="flex items-center gap-3">
                      <label className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                        Choose Files
                        <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => {
                          if (e.target.files) setAddUploadedFiles(prev => ({ ...prev, [key]: [...prev[key], ...Array.from(e.target.files!)] }));
                        }} />
                      </label>
                      <span className="text-xs text-muted-foreground">{addUploadedFiles[key].length > 0 ? addUploadedFiles[key].map(f => f.name).join(", ") : "No file chosen"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2 border-t">
            <Button variant="outline" onClick={() => setAddingTenant(false)}>Cancel</Button>
            <Button onClick={saveNewTenant}>Add Tenant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span>{value || "—"}</span>
    </div>
  );
}

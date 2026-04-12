import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUnits, useDeleteUnit, Unit } from "@/hooks/useRooms";
import { useLocations } from "@/hooks/useLocations";
import { useCondos } from "@/hooks/useCondos";
import AddUnit from "@/pages/AddUnit";
import EditUnit from "@/pages/EditUnit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Pencil, Trash2, Eye, Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface UnitsRoomsContentProps {
  onEditUnit: (unit: any) => void;
}

export function UnitsRoomsContent({ onEditUnit }: UnitsRoomsContentProps) {
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();
  const deleteUnit = useDeleteUnit();

  const [search, setSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnitType, setSelectedUnitType] = useState<string>("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const { sort, handleSort, sortData } = useTableSort("building");

  // Derive filter options
  const locations = useMemo(() => {
    const set = new Set(units.map(u => u.location).filter(Boolean));
    return Array.from(set).sort();
  }, [units]);

  const buildings = useMemo(() => {
    const source = selectedLocations.length
      ? units.filter(u => selectedLocations.includes(u.location))
      : units;
    const set = new Set(source.map(u => u.building).filter(Boolean));
    return Array.from(set).sort();
  }, [units, selectedLocations]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let list = units;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.building.toLowerCase().includes(q) ||
        u.unit.toLowerCase().includes(q) ||
        u.location.toLowerCase().includes(q)
      );
    }
    if (selectedLocations.length) list = list.filter(u => selectedLocations.includes(u.location));
    if (selectedBuildings.length) list = list.filter(u => selectedBuildings.includes(u.building));
    if (selectedUnitType !== "all") list = list.filter(u => u.unit_type?.toLowerCase().includes(selectedUnitType));

    return sortData(list, (u: Unit, key: string) => {
      const rooms = u.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
      const carparks = u.rooms?.filter(r => r.room_type === "Car Park") ?? [];
      const map: Record<string, any> = {
        location: u.location,
        building: u.building,
        unit: u.unit,
        unit_type: u.unit_type,
        max_pax: u.unit_max_pax,
        
        total_rooms: rooms.length,
        total_carparks: carparks.length,
        remaining_rooms: rooms.filter(r => r.status === "Available").length,
        remaining_carparks: carparks.filter(r => r.status === "Available").length,
        
      };
      return map[key];
    });
  }, [units, search, selectedLocations, selectedBuildings, selectedUnitType, sort]);

  useEffect(() => { setCurrentPage(1); }, [search, selectedLocations, selectedBuildings, selectedUnitType, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const applyLocations = (next: string[]) => {
    setSelectedLocations(next);
    if (next.length) {
      setSelectedBuildings(prev => {
        const valid = new Set(units.filter(u => next.includes(u.location)).map(u => u.building));
        return prev.filter(b => valid.has(b));
      });
    }
  };

  const hasFilters = selectedLocations.length > 0 || selectedBuildings.length > 0 || selectedUnitType !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setSelectedLocations([]);
    setSelectedBuildings([]);
    setSelectedUnitType("all");
    setSearch("");
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteUnit.mutateAsync(deleteConfirm);
    } catch (e: any) {
      alert(e.message || "Failed to delete unit");
    }
    setDeleteConfirm(null);
  };

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Units & Rooms</h2>
        <Button onClick={() => setAddUnitOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Unit
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by building, unit, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputClass} w-full pl-10`}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <MultiSelectFilter
            label="Location"
            placeholder="Select location"
            options={locations}
            selected={selectedLocations}
            onApply={applyLocations}
            className="min-w-[200px]"
          />
          <MultiSelectFilter
            label="Building"
            placeholder="Select building"
            options={buildings}
            selected={selectedBuildings}
            onApply={next => setSelectedBuildings(next)}
            className="min-w-[200px]"
          />
          <div className="space-y-1.5 min-w-[160px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Type</label>
            <Select onValueChange={setSelectedUnitType} value={selectedUnitType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mix">Mix Unit</SelectItem>
                <SelectItem value="female">Female Unit</SelectItem>
                <SelectItem value="male">Male Unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        {(selectedLocations.length > 0 || selectedBuildings.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {selectedLocations.map(l => (
              <Badge key={`loc-${l}`} variant="secondary" className="gap-1 capitalize cursor-pointer" onClick={() => applyLocations(selectedLocations.filter(x => x !== l))}>
                {l} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedBuildings.map(b => (
              <Badge key={`bld-${b}`} variant="outline" className="gap-1 cursor-pointer" onClick={() => setSelectedBuildings(prev => prev.filter(x => x !== b))}>
                {b} <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <span className="text-sm text-muted-foreground">{filteredRows.length} unit(s) found</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading units…</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No units match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10" /> {/* expand toggle */}
                    <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                    <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit Number</SortableTableHead>
                    <SortableTableHead sortKey="unit_type" currentSort={sort} onSort={handleSort}>Unit Type</SortableTableHead>
                    <SortableTableHead sortKey="max_pax" currentSort={sort} onSort={handleSort} className="text-center">Max Occupants</SortableTableHead>
                    
                    <SortableTableHead sortKey="remaining_rooms" currentSort={sort} onSort={handleSort} className="text-center">Remaining Rooms</SortableTableHead>
                    <SortableTableHead sortKey="remaining_carparks" currentSort={sort} onSort={handleSort} className="text-center">Remaining Carparks</SortableTableHead>
                    
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map(unit => {
                    const rooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
                    const carparks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
                    const availableRooms = rooms.filter(r => r.status === "Available").length;
                    const availableCarparks = carparks.filter(r => r.status === "Available").length;
                    const isExpanded = expandedRows.has(unit.id);

                    return (
                      <>
                        <TableRow key={unit.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleExpand(unit.id)}>
                          <TableCell className="w-10 px-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{unit.building || "—"}</TableCell>
                          <TableCell>{unit.unit}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                unit.unit_type?.toLowerCase().includes("female")
                                  ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                                  : unit.unit_type?.toLowerCase().includes("male") && !unit.unit_type?.toLowerCase().includes("female")
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : ""
                              }
                            >
                              {unit.unit_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{unit.unit_max_pax}</TableCell>
                          
                          <TableCell className="text-center">
                            <span className={availableRooms > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableRooms}</span>
                            <span className="text-muted-foreground">/{rooms.length}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={availableCarparks > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableCarparks}</span>
                            <span className="text-muted-foreground">/{carparks.length}</span>
                          </TableCell>
                          
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewingUnit(unit)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => setEditUnitId(unit.id)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteConfirm(unit.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Expanded room preview */}
                        {isExpanded && (
                          <TableRow key={`${unit.id}-expand`} className="bg-muted/10">
                            <TableCell colSpan={11} className="p-0">
                               <div className="px-8 py-3 space-y-4">
                                 {/* Rooms sub-table */}
                                 {(() => {
                                   const unitRooms = (unit.rooms || []).filter(r => r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark"));
                                   const unitCarparks = (unit.rooms || []).filter(r => r.room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark"));
                                   return (
                                     <>
                                       {unitRooms.length === 0 && unitCarparks.length === 0 && (
                                         <div className="text-sm text-muted-foreground py-2">No rooms configured.</div>
                                       )}
                                       {unitRooms.length > 0 && (
                                         <div>
                                           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rooms</div>
                                           <div className="grid gap-1">
                                             <div className="grid grid-cols-[60px_80px_80px_120px_60px_70px_100px_90px_60px_80px_70px] text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 border-b border-border/50">
                                               <span>Room</span>
                                               <span>Bed</span>
                                               <span>Wall</span>
                                               <span>Features</span>
                                               <span>Pax</span>
                                               <span>Rent</span>
                                               <span>Status</span>
                                               <span>Avail. Date</span>
                                               <span>Stay</span>
                                               <span>Nationality</span>
                                               <span>Gender</span>
                                             </div>
                                             {unitRooms.map(room => {
                                               const feats = [...((room as any).optional_features || [])];
                                               if (((room as any).room_category === "Studio" || room.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
                                               return (
                                                 <div key={room.id} className="grid grid-cols-[60px_80px_80px_120px_60px_70px_100px_90px_60px_80px_70px] text-sm py-1.5 items-center">
                                                   <span className="font-medium">{room.room.replace(/^Room\s+/i, "")}</span>
                                                   <span className="text-muted-foreground">{room.bed_type || "—"}</span>
                                                   <span className="text-muted-foreground">{(room as any).wall_type || "—"}</span>
                                                   <span className="text-muted-foreground text-xs truncate">{feats.length > 0 ? feats.join(", ") : "—"}</span>
                                                   <span>{room.max_pax}</span>
                                                   <span>RM{room.rent}</span>
                                                   <span><StatusBadge status={room.status} /></span>
                                                   <span className="text-muted-foreground">{(room.status === "Available Soon" || room.status === "Pending") ? (room.available_date || "—") : ""}</span>
                                                   <span>{room.pax_staying || 0}</span>
                                                   <span className="text-muted-foreground truncate">{(room as any).tenant_nationality || "—"}</span>
                                                   <span className="text-muted-foreground">{room.tenant_gender || "—"}</span>
                                                 </div>
                                               );
                                             })}
                                           </div>
                                         </div>
                                       )}
                                       {unitCarparks.length > 0 && (
                                         <div>
                                           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Carparks</div>
                                           <div className="grid gap-1">
                                             <div className="grid grid-cols-[120px_100px_80px_100px_1fr] text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 border-b border-border/50">
                                               <span>Name</span>
                                               <span>Lot</span>
                                               <span>Rent</span>
                                               <span>Status</span>
                                               <span>Remark</span>
                                             </div>
                                             {unitCarparks.map(cp => (
                                               <div key={cp.id} className="grid grid-cols-[120px_100px_80px_100px_1fr] text-sm py-1.5 items-center">
                                                 <span className="font-medium">🅿️ {cp.room}</span>
                                                 <span className="text-muted-foreground">{(cp as any).parking_lot || "—"}</span>
                                                 <span>RM{cp.rent}</span>
                                                 <span><StatusBadge status={cp.status} /></span>
                                                 <span className="text-muted-foreground truncate">{(cp as any).internal_remark || "—"}</span>
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       )}
                                     </>
                                   );
                                 })()}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this unit?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the unit and all its rooms. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewingUnit} onOpenChange={open => { if (!open) setViewingUnit(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Unit Details — {viewingUnit?.building} · {viewingUnit?.unit}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0 space-y-5 pb-4">
            {viewingUnit && (() => {
              const unitRooms = (viewingUnit.rooms || []).filter(r => r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark"));
              const unitCarparks = (viewingUnit.rooms || []).filter(r => r.room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark"));
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              return (
                <>
                  {((viewingUnit as any).common_photos || []).length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {((viewingUnit as any).common_photos as string[]).map((path: string, i: number) => (
                        <img key={i} src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border" />
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{viewingUnit.location}</span></div>
                    <div><span className="text-muted-foreground">Building:</span> <span className="font-medium">{viewingUnit.building}</span></div>
                    <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium">{viewingUnit.unit}</span></div>
                    <div><span className="text-muted-foreground">Unit Type:</span> <span className="font-medium">{viewingUnit.unit_type}</span></div>
                    <div><span className="text-muted-foreground">Max Occupants:</span> <span className="font-medium">{viewingUnit.unit_max_pax}</span></div>
                    <div><span className="text-muted-foreground">Deposit:</span> <span className="font-medium">{(viewingUnit as any).deposit_multiplier} months</span></div>
                    <div><span className="text-muted-foreground">Admin Fee:</span> <span className="font-medium">RM{(viewingUnit as any).admin_fee}</span></div>
                    <div><span className="text-muted-foreground">Meter:</span> <span className="font-medium">{(viewingUnit as any).meter_type} · RM{(viewingUnit as any).meter_rate}/kWh</span></div>
                    <div><span className="text-muted-foreground">Passcode:</span> <span className="font-medium">{viewingUnit.passcode || "—"}</span></div>
                    <div><span className="text-muted-foreground">WiFi:</span> <span className="font-medium">{(viewingUnit as any).wifi_name || "—"}</span></div>
                    <div><span className="text-muted-foreground">WiFi PW:</span> <span className="font-medium">{(viewingUnit as any).wifi_password || "—"}</span></div>
                    <div><span className="text-muted-foreground">Internal Only:</span> <span className="font-medium">{(viewingUnit as any).internal_only ? "🔒 Yes" : "No"}</span></div>
                  </div>

                  {unitRooms.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Rooms</div>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Room</TableHead>
                              <TableHead>Bed Type</TableHead>
                              <TableHead>Wall Type</TableHead>
                              <TableHead>Features</TableHead>
                              <TableHead className="text-center">Max Pax</TableHead>
                              <TableHead className="text-right">Rental</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Avail. Date</TableHead>
                              <TableHead className="text-center">Pax</TableHead>
                              <TableHead>Nationality</TableHead>
                              <TableHead>Gender</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unitRooms.map(room => {
                              const feats = [...((room as any).optional_features || [])];
                              if (((room as any).room_category === "Studio" || room.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
                              return (
                                <TableRow key={room.id}>
                                  <TableCell className="font-medium">{room.room.replace(/^Room\s+/i, "")}</TableCell>
                                  <TableCell>{room.bed_type || "—"}</TableCell>
                                  <TableCell>{(room as any).wall_type || "—"}</TableCell>
                                  <TableCell><div className="flex flex-wrap gap-1">{feats.length > 0 ? feats.map((f: string) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>) : <span className="text-muted-foreground text-xs">—</span>}</div></TableCell>
                                  <TableCell className="text-center">{room.max_pax}</TableCell>
                                  <TableCell className="text-right">RM{room.rent}</TableCell>
                                  <TableCell><StatusBadge status={room.status} /></TableCell>
                                  <TableCell>{(room.status === "Available Soon" || room.status === "Pending") ? (room.available_date || "—") : ""}</TableCell>
                                  <TableCell className="text-center">{room.pax_staying || 0}</TableCell>
                                  <TableCell>{(room as any).tenant_nationality || "—"}</TableCell>
                                  <TableCell>{room.tenant_gender || "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {unitCarparks.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Carparks</div>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Lot</TableHead>
                              <TableHead className="text-right">Rental</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Remark</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unitCarparks.map(cp => (
                              <TableRow key={cp.id}>
                                <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                                <TableCell>{(cp as any).parking_lot || "—"}</TableCell>
                                <TableCell className="text-right">RM{cp.rent}</TableCell>
                                <TableCell><StatusBadge status={cp.status} /></TableCell>
                                <TableCell>{(cp as any).internal_remark || "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Unit Dialog */}
      <Dialog open={addUnitOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Add Unit</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AddUnit onClose={() => setAddUnitOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

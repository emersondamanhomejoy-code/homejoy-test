import { useState, useMemo } from "react";
import EditUnit from "@/pages/EditUnit";
import { useNavigate } from "react-router-dom";
import { useUnits, useDeleteRoom, Room } from "@/hooks/useRooms";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronLeft, ChevronRight, Search, X, Eye, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export function RoomsContent() {
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [selectedBedTypes, setSelectedBedTypes] = useState<string[]>([]);
  const [selectedWallTypes, setSelectedWallTypes] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [editFocusRoomId, setEditFocusRoomId] = useState<string | undefined>(undefined);
  const [viewingRoom, setViewingRoom] = useState<(Room & { unitName: string; unit_type_val: string }) | null>(null);

  const { sort, handleSort, sortData } = useTableSort("building");

  // Flatten all rooms (exclude car parks)
  const allRooms = useMemo(() => {
    const flat: (Room & { unitName: string; unit_type_val: string })[] = [];
    for (const unit of units) {
      for (const room of unit.rooms || []) {
        if ((room as any).room_type === "Car Park" || (room.room || "").toLowerCase().startsWith("carpark")) continue;
        flat.push({ ...room, unitName: unit.unit, unit_type_val: unit.unit_type });
      }
    }
    return flat;
  }, [units]);

  // Derive filter options
  const locations = useMemo(() => Array.from(new Set(allRooms.map(r => r.location).filter(Boolean))).sort(), [allRooms]);
  const buildings = useMemo(() => {
    const source = selectedLocations.length ? allRooms.filter(r => selectedLocations.includes(r.location)) : allRooms;
    return Array.from(new Set(source.map(r => r.building).filter(Boolean))).sort();
  }, [allRooms, selectedLocations]);
  const unitNumbers = useMemo(() => {
    let source = allRooms;
    if (selectedLocations.length) source = source.filter(r => selectedLocations.includes(r.location));
    if (selectedBuildings.length) source = source.filter(r => selectedBuildings.includes(r.building));
    return Array.from(new Set(source.map(r => r.unit).filter(Boolean))).sort();
  }, [allRooms, selectedLocations, selectedBuildings]);
  const unitTypes = useMemo(() => Array.from(new Set(allRooms.map(r => r.unit_type_val).filter(Boolean))).sort(), [allRooms]);
  
  const bedTypes = useMemo(() => Array.from(new Set(allRooms.map(r => r.bed_type).filter(Boolean))).sort(), [allRooms]);
  const wallTypes = useMemo(() => Array.from(new Set(allRooms.map(r => (r as any).wall_type).filter(Boolean))).sort(), [allRooms]);
  const featureOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRooms) {
      const feats = (r as any).optional_features || [];
      if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) set.add("Studio");
      for (const f of feats) if (f) set.add(f);
    }
    return Array.from(set).sort();
  }, [allRooms]);

  // Filter
  const filtered = useMemo(() => {
    let list = allRooms;
    if (selectedLocations.length) list = list.filter(r => selectedLocations.includes(r.location));
    if (selectedBuildings.length) list = list.filter(r => selectedBuildings.includes(r.building));
    if (selectedUnits.length) list = list.filter(r => selectedUnits.includes(r.unit));
    if (selectedUnitTypes.length) list = list.filter(r => selectedUnitTypes.includes(r.unit_type_val));
    
    if (selectedBedTypes.length) list = list.filter(r => selectedBedTypes.includes(r.bed_type));
    if (selectedWallTypes.length) list = list.filter(r => selectedWallTypes.includes((r as any).wall_type));
    if (selectedFeatures.length) list = list.filter(r => {
      const feats = [...((r as any).optional_features || [])];
      if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
      return selectedFeatures.some(f => feats.includes(f));
    });
    if (statusFilter !== "all") list = list.filter(r => r.status === statusFilter);
    if (minPrice) list = list.filter(r => r.rent >= Number(minPrice));
    if (maxPrice) list = list.filter(r => r.rent <= Number(maxPrice));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.building.toLowerCase().includes(s) ||
        r.unit.toLowerCase().includes(s) ||
        r.room.toLowerCase().includes(s) ||
        r.location.toLowerCase().includes(s)
      );
    }

    return sortData(list, (r: any, key: string) => {
      const map: Record<string, any> = {
        room: r.room,
        location: r.location,
        building: r.building,
        unit: r.unit,
        unit_type: r.unit_type_val,
        
        bed_type: r.bed_type,
        wall_type: r.wall_type || "",
        rent: r.rent,
        status: r.status,
        available_date: r.available_date || "",
        pax_staying: r.pax_staying || 0,
        updated_at: r.updated_at || "",
      };
      return map[key];
    });
  }, [allRooms, selectedLocations, selectedBuildings, selectedUnits, selectedUnitTypes, selectedBedTypes, selectedWallTypes, selectedFeatures, statusFilter, minPrice, maxPrice, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const hasFilters = selectedLocations.length > 0 || selectedBuildings.length > 0 || selectedUnits.length > 0 ||
    selectedUnitTypes.length > 0 || selectedBedTypes.length > 0 ||
    selectedWallTypes.length > 0 || selectedFeatures.length > 0 || statusFilter !== "all" || minPrice || maxPrice || search.trim();

  const clearFilters = () => {
    setSelectedLocations([]); setSelectedBuildings([]); setSelectedUnits([]);
    setSelectedUnitTypes([]); setSelectedBedTypes([]);
    setSelectedWallTypes([]); setSelectedFeatures([]); setStatusFilter("all"); setMinPrice(""); setMaxPrice("");
    setSearch(""); setPage(1);
  };

  const handleExport = () => {
    const headers = ["Room Name","Location","Building","Unit Number","Unit Type","Bed Type","Wall Type","Features","Monthly Rental","Status","Available Date","Pax Staying","Nationality","Gender","Last Updated"];
    const rows = filtered.map(r => {
      const feats = [...((r as any).optional_features || [])];
      if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
      return [
        r.room, r.location, r.building, r.unit, r.unit_type_val,
        r.bed_type || "", (r as any).wall_type || "", feats.join(", "),
        r.rent, r.status,
        (r.status === "Available Soon" || r.status === "Pending") ? (r.available_date || "") : "",
        r.pax_staying || 0,
        (r as any).tenant_nationality || "", r.tenant_gender || "",
        r.updated_at ? format(new Date(r.updated_at), "yyyy-MM-dd HH:mm") : "",
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "rooms_export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV.");
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRoom.mutateAsync(deleteConfirm);
      toast.success("Room removed.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete.");
    }
    setDeleteConfirm(null);
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Rooms</h2>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by room, unit, building, location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className={`${inputClass} w-full pl-10`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <MultiSelectFilter label="Location" placeholder="All Locations" options={locations} selected={selectedLocations}
            onApply={v => { setSelectedLocations(v); setSelectedBuildings([]); setSelectedUnits([]); setPage(1); }} />
          <MultiSelectFilter label="Building" placeholder="All Buildings" options={buildings} selected={selectedBuildings}
            onApply={v => { setSelectedBuildings(v); setSelectedUnits([]); setPage(1); }} />
          <MultiSelectFilter label="Unit" placeholder="All Units" options={unitNumbers} selected={selectedUnits}
            onApply={v => { setSelectedUnits(v); setPage(1); }} />
          <MultiSelectFilter label="Unit Type" placeholder="All Unit Types" options={unitTypes} selected={selectedUnitTypes}
            onApply={v => { setSelectedUnitTypes(v); setPage(1); }} />
          <MultiSelectFilter label="Bed Type" placeholder="All Bed Types" options={bedTypes} selected={selectedBedTypes}
            onApply={v => { setSelectedBedTypes(v); setPage(1); }} />
          <MultiSelectFilter label="Wall Type" placeholder="All Wall Types" options={wallTypes} selected={selectedWallTypes}
            onApply={v => { setSelectedWallTypes(v); setPage(1); }} />
          <MultiSelectFilter label="Features" placeholder="All Features" options={featureOptions} selected={selectedFeatures}
            onApply={v => { setSelectedFeatures(v); setPage(1); }} />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Available Soon">Available Soon</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Occupied">Occupied</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Range</label>
            <div className="flex items-center gap-1">
              <input type="number" placeholder="Min" className={`${inputClass} w-20`} value={minPrice}
                onChange={e => { setMinPrice(e.target.value); setPage(1); }} />
              <span className="text-muted-foreground text-xs">–</span>
              <input type="number" placeholder="Max" className={`${inputClass} w-20`} value={maxPrice}
                onChange={e => { setMaxPrice(e.target.value); setPage(1); }} />
            </div>
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
        <div className="px-6 py-4 border-b border-border">
          <span className="text-sm text-muted-foreground">{filtered.length} room(s) found</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No rooms match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
                    
                    <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                    <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                    <SortableTableHead sortKey="unit_type" currentSort={sort} onSort={handleSort}>Unit Type</SortableTableHead>
                    <SortableTableHead sortKey="bed_type" currentSort={sort} onSort={handleSort}>Bed Type</SortableTableHead>
                    <SortableTableHead sortKey="wall_type" currentSort={sort} onSort={handleSort}>Wall Type</SortableTableHead>
                    <TableHead>Features</TableHead>
                    <SortableTableHead sortKey="rent" currentSort={sort} onSort={handleSort} className="text-right">Rental (RM)</SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                    
                    <SortableTableHead sortKey="pax_staying" currentSort={sort} onSort={handleSort} className="text-center">Pax</SortableTableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Gender</TableHead>
                    
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.room.replace(/^Room\s+/i, "")}</TableCell>
                      
                      <TableCell>{r.building}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          r.unit_type_val?.toLowerCase().includes("female")
                            ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                            : r.unit_type_val?.toLowerCase().includes("male") && !r.unit_type_val?.toLowerCase().includes("female")
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : ""
                        }>{r.unit_type_val}</Badge>
                      </TableCell>
                      <TableCell>{r.bed_type || "—"}</TableCell>
                      <TableCell>{(r as any).wall_type || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const feats = [...((r as any).optional_features || [])];
                            if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
                            return feats.length > 0 ? feats.map((f: string) => (
                              <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                            )) : <span className="text-muted-foreground text-xs">—</span>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">RM{r.rent}</TableCell>
                      <TableCell><StatusBadge status={r.status} availableDate={r.available_date} /></TableCell>
                      <TableCell className="text-center">{r.pax_staying || 0}</TableCell>
                      <TableCell className="text-muted-foreground">{(r as any).tenant_nationality || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.tenant_gender || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewingRoom(r)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditUnitId(r.unit_id); setEditFocusRoomId(r.id); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Archive / Remove" onClick={() => setDeleteConfirm(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows:</span>
                <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive / Remove this room?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The room will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Unit Dialog */}
      <Dialog open={!!editUnitId} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Edit Unit</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {editUnitId && <EditUnit unitIdProp={editUnitId} onClose={() => setEditUnitId(null)} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

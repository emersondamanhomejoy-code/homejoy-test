import { useState, useMemo } from "react";
import EditRoom from "@/pages/EditRoom";
import { useNavigate } from "react-router-dom";
import { useUnits, useDeleteRoom, Room, Unit } from "@/hooks/useRooms";
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
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Trash2, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardModal } from "@/components/ui/standard-modal";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/lib/ui-constants";

// Status tabs
const STATUS_TABS = ["All", "Available", "Available Soon", "Pending", "Occupied", "Archived"] as const;

interface FlatRoom extends Room {
  unitName: string;
  unit_type_val: string;
  unitMaxPax: number;
  unitOccupiedPax: number;
  effectiveRemaining: number;
}

function computeEffectiveRemaining(room: Room, unit: Unit): number {
  const roomRemaining = Math.max(0, room.max_pax - (room.pax_staying || 0));
  const unitOccupied = (unit.rooms || [])
    .filter(r => (r as any).room_type !== "Car Park")
    .reduce((sum, r) => sum + (r.pax_staying || 0), 0);
  const unitRemaining = Math.max(0, unit.unit_max_pax - unitOccupied);
  return Math.min(roomRemaining, unitRemaining);
}

export function RoomsContent() {
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();
  const deleteRoom = useDeleteRoom();

  // Default visible filters
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("All");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [selectedBedTypes, setSelectedBedTypes] = useState<string[]>([]);
  const [selectedWallTypes, setSelectedWallTypes] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [internalOnly, setInternalOnly] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");

  // State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [viewingRoom, setViewingRoom] = useState<FlatRoom | null>(null);
  const { sort, handleSort, sortData } = useTableSort("building");

  // Flatten rooms (exclude car parks)
  const allRooms = useMemo<FlatRoom[]>(() => {
    const flat: FlatRoom[] = [];
    for (const unit of units) {
      for (const room of unit.rooms || []) {
        if ((room as any).room_type === "Car Park" || (room.room || "").toLowerCase().startsWith("carpark")) continue;
        const unitOccupied = (unit.rooms || [])
          .filter(r => (r as any).room_type !== "Car Park")
          .reduce((sum, r) => sum + (r.pax_staying || 0), 0);
        flat.push({
          ...room,
          unitName: unit.unit,
          unit_type_val: unit.unit_type,
          unitMaxPax: unit.unit_max_pax,
          unitOccupiedPax: unitOccupied,
          effectiveRemaining: computeEffectiveRemaining(room, unit),
        });
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

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allRooms.length };
    for (const r of allRooms) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    return counts;
  }, [allRooms]);

  // Filter
  const filtered = useMemo(() => {
    let list = allRooms;
    if (statusTab !== "All") list = list.filter(r => r.status === statusTab);
    if (selectedLocations.length) list = list.filter(r => selectedLocations.includes(r.location));
    if (selectedBuildings.length) list = list.filter(r => selectedBuildings.includes(r.building));
    if (selectedUnitTypes.length) list = list.filter(r => selectedUnitTypes.includes(r.unit_type_val));
    if (selectedBedTypes.length) list = list.filter(r => selectedBedTypes.includes(r.bed_type));
    if (selectedWallTypes.length) list = list.filter(r => selectedWallTypes.includes((r as any).wall_type));
    if (selectedFeatures.length) list = list.filter(r => {
      const feats = [...((r as any).optional_features || [])];
      if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
      return selectedFeatures.some(f => feats.includes(f));
    });
    if (minPrice) list = list.filter(r => r.rent >= Number(minPrice));
    if (maxPrice) list = list.filter(r => r.rent <= Number(maxPrice));
    if (minCapacity) list = list.filter(r => r.effectiveRemaining >= Number(minCapacity));
    if (internalOnly === "yes") list = list.filter(r => r.internal_only);
    if (internalOnly === "no") list = list.filter(r => !r.internal_only);
    if (availableFrom || availableTo) {
      list = list.filter(r => {
        if (!r.available_date || r.available_date === "Available Now") return false;
        const d = r.available_date;
        if (availableFrom && d < availableFrom) return false;
        if (availableTo && d > availableTo) return false;
        return true;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.building.toLowerCase().includes(s) ||
        r.unit.toLowerCase().includes(s) ||
        r.room.toLowerCase().includes(s) ||
        ((r as any).room_title || "").toLowerCase().includes(s)
      );
    }
    return sortData(list, (r: any, key: string) => {
      const map: Record<string, any> = {
        room: r.room, building: r.building, unit: r.unit,
        unit_type: r.unit_type_val, bed_type: r.bed_type,
        wall_type: r.wall_type || "", rent: r.rent,
        status: r.status, available_date: r.available_date || "",
        effectiveRemaining: r.effectiveRemaining,
      };
      return map[key];
    });
  }, [allRooms, statusTab, selectedLocations, selectedBuildings, selectedUnitTypes, selectedBedTypes, selectedWallTypes, selectedFeatures, minPrice, maxPrice, minCapacity, internalOnly, availableFrom, availableTo, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const hasAdvancedFilters = selectedUnitTypes.length > 0 || selectedBedTypes.length > 0 || selectedWallTypes.length > 0 || selectedFeatures.length > 0 || !!minPrice || !!maxPrice || !!minCapacity || !!internalOnly || !!availableFrom || !!availableTo;
  const hasAnyFilter = selectedLocations.length > 0 || selectedBuildings.length > 0 || statusTab !== "All" || hasAdvancedFilters || !!search.trim();

  const clearFilters = () => {
    setSelectedLocations([]); setSelectedBuildings([]);
    setSelectedUnitTypes([]); setSelectedBedTypes([]);
    setSelectedWallTypes([]); setSelectedFeatures([]);
    setStatusTab("All"); setMinPrice(""); setMaxPrice("");
    setMinCapacity(""); setInternalOnly(""); setAvailableFrom(""); setAvailableTo("");
    setSearch(""); setPage(1);
  };

  const handleExport = () => {
    const headers = ["Building", "Unit", "Room", "Unit Type", "Bed Type", "Wall Type", "Features", "Listed Rental", "Status", "Effective Remaining"];
    const rows = filtered.map(r => {
      const feats = [...((r as any).optional_features || [])];
      if (((r as any).room_category === "Studio" || r.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
      return [
        r.building, r.unit, r.room, r.unit_type_val,
        r.bed_type || "", (r as any).wall_type || "", feats.join(", "),
        r.rent, r.status,
        r.effectiveRemaining,
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
    <StandardPageLayout
      title="Rooms"
      secondaryActions={
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      }
    >
      {/* Compact filter bar */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-3">
        {/* Row 1: Search + Status pills + Location + Building + Advanced toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search building, unit, room..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className={`${inputClass} w-full pl-10`}
            />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => { setStatusTab(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusTab === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s} {statusCounts[s] !== undefined ? `(${statusCounts[s]})` : "(0)"}
              </button>
            ))}
          </div>

          {/* Location */}
          <MultiSelectFilter label="Location" placeholder="All" options={locations} selected={selectedLocations}
            onApply={v => { setSelectedLocations(v); setSelectedBuildings([]); setPage(1); }} className="min-w-[140px]" />

          {/* Building */}
          <MultiSelectFilter label="Building" placeholder="All" options={buildings} selected={selectedBuildings}
            onApply={v => { setSelectedBuildings(v); setPage(1); }} className="min-w-[140px]" />

          {/* Advanced toggle */}
          <Button
            variant={showAdvanced ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-1"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasAdvancedFilters && <Badge variant="destructive" className="h-4 px-1 text-[10px] ml-1">{[selectedUnitTypes, selectedBedTypes, selectedWallTypes, selectedFeatures].filter(a => a.length).length + (minPrice || maxPrice ? 1 : 0) + (minCapacity ? 1 : 0) + (internalOnly ? 1 : 0) + (availableFrom || availableTo ? 1 : 0)}</Badge>}
          </Button>

          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Advanced filter panel */}
        {showAdvanced && (
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
            <MultiSelectFilter label="Unit Type" placeholder="All" options={unitTypes} selected={selectedUnitTypes}
              onApply={v => { setSelectedUnitTypes(v); setPage(1); }} className="min-w-[130px]" />
            <MultiSelectFilter label="Bed Type" placeholder="All" options={bedTypes} selected={selectedBedTypes}
              onApply={v => { setSelectedBedTypes(v); setPage(1); }} className="min-w-[130px]" />
            <MultiSelectFilter label="Wall Type" placeholder="All" options={wallTypes} selected={selectedWallTypes}
              onApply={v => { setSelectedWallTypes(v); setPage(1); }} className="min-w-[130px]" />
            <MultiSelectFilter label="Features" placeholder="All" options={featureOptions} selected={selectedFeatures}
              onApply={v => { setSelectedFeatures(v); setPage(1); }} className="min-w-[130px]" />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Listed Rental</label>
              <div className="flex items-center gap-1">
                <input type="number" placeholder="Min" className={`${inputClass} w-20`} value={minPrice}
                  onChange={e => { setMinPrice(e.target.value); setPage(1); }} />
                <span className="text-muted-foreground text-xs">–</span>
                <input type="number" placeholder="Max" className={`${inputClass} w-20`} value={maxPrice}
                  onChange={e => { setMaxPrice(e.target.value); setPage(1); }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Capacity</label>
              <input type="number" placeholder="≥" className={`${inputClass} w-16`} value={minCapacity}
                onChange={e => { setMinCapacity(e.target.value); setPage(1); }} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Only</label>
              <Select value={internalOnly || "all"} onValueChange={v => { setInternalOnly(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available On</label>
              <div className="flex items-center gap-1">
                <input type="date" className={`${inputClass} w-[130px]`} value={availableFrom}
                  onChange={e => { setAvailableFrom(e.target.value); setPage(1); }} />
                <span className="text-muted-foreground text-xs">–</span>
                <input type="date" className={`${inputClass} w-[130px]`} value={availableTo}
                  onChange={e => { setAvailableTo(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>
        )}
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
                    <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                    <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                    <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Code</SortableTableHead>
                    <SortableTableHead sortKey="room_title" currentSort={sort} onSort={handleSort}>Room Title</SortableTableHead>
                    <SortableTableHead sortKey="rent" currentSort={sort} onSort={handleSort} className="text-right">Listed Rental</SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                    
                    <SortableTableHead sortKey="effectiveRemaining" currentSort={sort} onSort={handleSort} className="text-center">Capacity</SortableTableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(r => {
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.building}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{r.room.replace(/^Room\s+/i, "")}</Badge></TableCell>
                        <TableCell className="font-medium">{(r as any).room_title || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="text-right font-medium">RM{r.rent}</TableCell>
                        <TableCell><StatusBadge status={r.status} availableDate={r.available_date} /></TableCell>
                        <TableCell className="text-center">
                          <span className={r.effectiveRemaining === 0 ? "text-destructive font-medium" : "font-medium"}>
                            {r.effectiveRemaining}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewingRoom(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditRoomId(r.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Archive / Remove" onClick={() => setDeleteConfirm(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Archive / Remove this room?"
        description="This action cannot be undone. The room will be permanently deleted."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* View Room Modal */}
      <StandardModal
        open={!!viewingRoom}
        onOpenChange={(o) => { if (!o) setViewingRoom(null); }}
        title="Room Details"
        size="md"
        hideCancel
        footer={<Button variant="outline" onClick={() => setViewingRoom(null)}>Close</Button>}
      >
        {viewingRoom && (() => {
          const feats = [...((viewingRoom as any).optional_features || [])];
          if (((viewingRoom as any).room_category === "Studio" || viewingRoom.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const photos = Array.isArray(viewingRoom.photos) ? viewingRoom.photos as string[] : [];

          return (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="text-lg font-semibold">{viewingRoom.building} · {viewingRoom.unit} · {viewingRoom.room}</div>
                {(viewingRoom as any).room_title && <div className="text-base font-medium mt-0.5">{(viewingRoom as any).room_title}</div>}
                <div className="text-sm text-muted-foreground">{viewingRoom.location}</div>
              </div>

              {/* Room Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Room Details</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Room Type:</span> {viewingRoom.room_type || "—"}</div>
                  <div><span className="text-muted-foreground">Unit Type:</span> {viewingRoom.unit_type_val || "—"}</div>
                  <div><span className="text-muted-foreground">Bed Type:</span> {viewingRoom.bed_type || "—"}</div>
                  <div><span className="text-muted-foreground">Wall Type:</span> {(viewingRoom as any).wall_type || "—"}</div>
                  <div><span className="text-muted-foreground">Listed Rental:</span> RM{viewingRoom.rent}</div>
                  <div><span className="text-muted-foreground">Max Pax:</span> {viewingRoom.max_pax}</div>
                </div>
                {feats.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground">Features:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {feats.map((f: string) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                    </div>
                  </div>
                )}
                {(viewingRoom as any).internal_remark && (
                  <div className="mt-2 text-sm"><span className="text-muted-foreground">Remark:</span> {(viewingRoom as any).internal_remark}</div>
                )}
              </div>

              {/* Status */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Status & Capacity</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewingRoom.status} availableDate={viewingRoom.available_date} /></div>
                  <div><span className="text-muted-foreground">Available On:</span> {viewingRoom.available_date || "—"}</div>
                  <div><span className="text-muted-foreground">Room Max Pax:</span> {viewingRoom.max_pax}</div>
                  <div><span className="text-muted-foreground">Pax Staying:</span> {viewingRoom.pax_staying || 0}</div>
                  <div><span className="text-muted-foreground">Unit Remaining:</span> {Math.max(0, viewingRoom.unitMaxPax - viewingRoom.unitOccupiedPax)}</div>
                  <div><span className="text-muted-foreground font-medium">Effective Remaining:</span> <span className="font-semibold">{viewingRoom.effectiveRemaining}</span></div>
                </div>
              </div>

              {/* Occupant context (only if occupied) */}
              {(viewingRoom.status === "Occupied" || viewingRoom.status === "Available Soon") && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Occupant Info</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Gender:</span> {viewingRoom.tenant_gender || "—"}</div>
                    <div><span className="text-muted-foreground">Race:</span> {viewingRoom.tenant_race || "—"}</div>
                    {(viewingRoom as any).tenancy_start_date && (
                      <div><span className="text-muted-foreground">Tenancy Start:</span> {(viewingRoom as any).tenancy_start_date}</div>
                    )}
                    {(viewingRoom as any).tenancy_end_date && (
                      <div><span className="text-muted-foreground">Tenancy End:</span> {(viewingRoom as any).tenancy_end_date}</div>
                    )}
                    {Array.isArray(viewingRoom.housemates) && viewingRoom.housemates.length > 0 && (
                      <div className="col-span-2"><span className="text-muted-foreground">Housemates:</span> {(viewingRoom.housemates as string[]).join(", ")}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Room Photos */}
              {photos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Room Photos</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p, i) => (
                      <a key={i} href={`${supabaseUrl}/storage/v1/object/public/room-photos/${p}`} target="_blank" rel="noopener noreferrer">
                        <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${p}`} alt={`Room photo ${i + 1}`} className="rounded-lg border object-cover h-24 w-full hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </StandardModal>

      {/* Edit Room Modal */}
      {editRoomId && (
        <EditRoom
          open={true}
          onOpenChange={(o) => { if (!o) setEditRoomId(null); }}
          roomId={editRoomId}
        />
      )}
    </StandardPageLayout>
  );
}

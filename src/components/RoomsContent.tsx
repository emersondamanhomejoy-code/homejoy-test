import { useState, useMemo, useEffect } from "react";
import { formatUnitType } from "@/lib/ui-constants";
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
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Trash2, SlidersHorizontal, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardModal } from "@/components/ui/standard-modal";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/lib/ui-constants";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { supabase } from "@/integrations/supabase/client";

// Status tabs
const STATUS_TABS = ["All", "Available", "Available Soon", "Pending", "Occupied", "Archived"] as const;
type AssetTab = "rooms" | "carparks";

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

  // Asset type toggle
  const [assetTab, setAssetTab] = useState<AssetTab>("rooms");

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
        const isCarPark = (room as any).room_type === "Car Park" || (room.room || "").toLowerCase().startsWith("carpark");
        if (assetTab === "rooms" && isCarPark) continue;
        if (assetTab === "carparks" && !isCarPark) continue;
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
  }, [units, assetTab]);

  // Derive filter options
  const locations = useMemo(() => Array.from(new Set(allRooms.map(r => r.location).filter(Boolean))).sort(), [allRooms]);
  const buildings = useMemo(() => {
    const source = selectedLocations.length ? allRooms.filter(r => selectedLocations.includes(r.location)) : allRooms;
    return Array.from(new Set(source.map(r => r.building).filter(Boolean))).sort();
  }, [allRooms, selectedLocations]);
  const unitTypes = useMemo(() => Array.from(new Set(allRooms.map(r => formatUnitType(r.unit_type_val)).filter(Boolean))).sort(), [allRooms]);
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
    if (selectedUnitTypes.length) list = list.filter(r => selectedUnitTypes.includes(formatUnitType(r.unit_type_val)));
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
        unit_type: formatUnitType(r.unit_type_val), bed_type: r.bed_type,
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
        r.building, r.unit, r.room, formatUnitType(r.unit_type_val),
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
      title={assetTab === "rooms" ? "Rooms" : "Car Parks"}
      secondaryActions={
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      }
    >
      {/* Asset type toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setAssetTab("rooms"); clearFilters(); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${assetTab === "rooms" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          Rooms
        </button>
        <button
          onClick={() => { setAssetTab("carparks"); clearFilters(); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${assetTab === "carparks" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          Car Parks
        </button>
      </div>
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
          <span className="text-sm text-muted-foreground">{filtered.length} {assetTab === "rooms" ? "room(s)" : "car park(s)"} found</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No {assetTab === "rooms" ? "rooms" : "car parks"} match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                    <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                    <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Code</SortableTableHead>
                    {assetTab === "rooms" && <SortableTableHead sortKey="room_title" currentSort={sort} onSort={handleSort}>Room Title</SortableTableHead>}
                    <SortableTableHead sortKey="rent" currentSort={sort} onSort={handleSort} className="text-right">{assetTab === "rooms" ? "Listed Rental" : "Rental"}</SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                    {assetTab === "rooms" && <SortableTableHead sortKey="effectiveRemaining" currentSort={sort} onSort={handleSort} className="text-center">Capacity</SortableTableHead>}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(r => {
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.building || "N/A"}</TableCell>
                        <TableCell>{r.unit || "N/A"}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{r.room.replace(/^Room\s+/i, "")}</Badge></TableCell>
                        {assetTab === "rooms" && <TableCell className="font-medium">{(r as any).room_title || <span className="text-muted-foreground italic">—</span>}</TableCell>}
                        <TableCell className="text-right font-medium">RM{r.rent}</TableCell>
                        <TableCell><StatusBadge status={r.status} availableDate={r.available_date} /></TableCell>
                        {assetTab === "rooms" && (
                          <TableCell className="text-center">
                            <span className={r.effectiveRemaining === 0 ? "text-destructive font-medium" : "font-medium"}>
                              {r.effectiveRemaining}
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewingRoom(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditRoomId(r.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteConfirm(r.id)}>
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
        title={assetTab === "rooms" ? "Remove this room?" : "Remove this car park?"}
        description={assetTab === "rooms" ? "This action cannot be undone. The room will be permanently deleted." : "This action cannot be undone. The car park will be permanently deleted."}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* View Room Modal */}
      <StandardModal
        open={!!viewingRoom}
        onOpenChange={(o) => { if (!o) setViewingRoom(null); }}
        title={assetTab === "rooms" ? "Room Details" : "Car Park Details"}
        size="lg"
        hideCancel
        footer={<Button variant="outline" onClick={() => setViewingRoom(null)}>Close</Button>}
      >
        {viewingRoom && <RoomViewContent room={viewingRoom} units={units} assetTab={assetTab} />}
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

/* ─── Room View Content (accordion-based, matches Units page design) ─── */

function RoomViewContent({ room, units, assetTab }: { room: FlatRoom; units: Unit[]; assetTab: AssetTab }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isCarpark = assetTab === "carparks";
  const [accordionValues, setAccordionValues] = useState<string[]>(["photos", "details", "status", "summary", "tenant"]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [linkedTenant, setLinkedTenant] = useState<any | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [linkedBooking, setLinkedBooking] = useState<any | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const parentUnit = units.find(u => u.id === room.unit_id);
  const photoUrls = Array.isArray(room.photos) ? (room.photos as string[]).map(p => `${supabaseUrl}/storage/v1/object/public/room-photos/${p}`) : [];
  const feats = [...((room as any).optional_features || [])];
  if (((room as any).room_category === "Studio" || room.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
  const effectiveRemaining = (room.max_pax || 0) - (room.pax_staying || 0);

  const otherRooms = (parentUnit?.rooms || []).filter(r =>
    r.id !== room.id && r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark")
  );

  const showTenantSection = ["Occupied", "Available Soon"].includes(room.status);

  // Fetch linked tenant
  useEffect(() => {
    if (!showTenantSection) { setLinkedTenant(null); return; }
    let cancelled = false;
    setTenantLoading(true);
    (async () => {
      const { data: trData } = await supabase
        .from("tenant_rooms")
        .select("tenant_id")
        .eq("room_id", room.id)
        .eq("status", "active")
        .limit(1);
      if (cancelled) return;
      if (trData && trData.length > 0) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", trData[0].tenant_id)
          .single();
        if (!cancelled) setLinkedTenant(tenantData || null);
      } else {
        setLinkedTenant(null);
      }
      setTenantLoading(false);
    })();
    return () => { cancelled = true; };
  }, [room.id, room.status]);

  // Fetch linked booking for this room
  useEffect(() => {
    let cancelled = false;
    setBookingLoading(true);
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled) {
        setLinkedBooking(data && data.length > 0 ? data[0] : null);
        setBookingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [room.id]);

  const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    if (!value || value === "—" || value === "") return null;
    return <div><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></div>;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const val = (v: string | undefined | null) => v?.trim() || "(not configured yet)";

  const TextCopyBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Copy className="h-3 w-3" /> {label}
    </button>
  );

  const copyRoomDetails = () => {
    const lines = [
      `Building: ${val(room.building)}`,
      `Unit: ${val(room.unit)}`,
      `Room: ${room.room} — ${(room as any).room_title || "N/A"}`,
      `─────────`,
      `Room Type: ${val((room as any).room_category || room.room_type)}`,
      `Unit Type: ${val(formatUnitType(room.unit_type_val))}`,
      `Bed Type: ${val(room.bed_type)}`,
      `Wall Type: ${val((room as any).wall_type)}`,
      `Listed Rent: RM${room.rent}`,
      `Status: ${room.status}`,
      `Available On: ${val(room.available_date)}`,
      `Remaining Pax: ${effectiveRemaining}`,
    ];
    if (feats.length > 0) lines.push(`Features: ${feats.join(", ")}`);
    if (room.internal_only) lines.push(`Internal Only: Yes`);
    copyToClipboard(lines.join("\n"), "Room details");
  };

  const copyHousemateDetails = () => {
    const rows = otherRooms.map(r => {
      const housemates = Array.isArray(r.housemates) ? r.housemates : [];
      const hmTenant = housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).name : (r as any).assigned_to;
      const hmGender = r.tenant_gender || (housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).gender : "");
      const hmRace = r.tenant_race || (housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).race : "");
      const hmOccupation = housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).occupation : "";
      const roomLabel = r.room.replace(/^Room\s+/i, "");
      return `Room ${roomLabel}: ${r.status} · ${hmTenant || "Vacant"} · ${hmGender || "N/A"} · ${hmRace || "N/A"} · ${hmOccupation || "N/A"}`;
    });
    copyToClipboard([`Building: ${room.building}`, `Unit: ${room.unit}`, `─────────`, `Housemates:`, ...rows].join("\n"), "Housemate details");
  };

  // Section keys for expand/collapse
  const sectionKeys: string[] = [];
  if (photoUrls.length > 0) sectionKeys.push("photos");
  sectionKeys.push("details");
  if (!isCarpark && otherRooms.length > 0) sectionKeys.push("summary");
  if (showTenantSection) sectionKeys.push("tenant");

  return (
    <div className="space-y-4">
      {/* Room name header + expand/collapse */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {isCarpark ? `Carpark ${room.room.replace(/^Carpark\s*/i, "")}` : `Room ${room.room.replace(/^Room\s+/i, "")}`}
          {(room as any).room_title ? ` — ${(room as any).room_title}` : ""}
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAccordionValues(prev => prev.length >= sectionKeys.length ? [] : [...sectionKeys])}>
          {accordionValues.length >= sectionKeys.length ? "Collapse All" : "Expand All"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">{room.building} · {room.unit} · {room.location}</div>

      <Accordion type="multiple" value={accordionValues} onValueChange={setAccordionValues} className="space-y-2">
        {/* 1. Room Photos */}
        {photoUrls.length > 0 && (
          <AccordionItem value="photos" className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">Room Photos</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-3">
                {photoUrls.map((url, i) => (
                  <img key={i} src={`${url}?width=160&height=160`} alt={`Photo ${i + 1}`} loading="lazy" width={80} height={80} className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxIndex(i)} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 2. Room Details */}
        <AccordionItem value="details" className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <div className="flex items-center gap-2 flex-1"><span>Room Details</span></div>
            <div className="flex items-center gap-1 mr-2">
              <TextCopyBtn onClick={copyRoomDetails} label="Copy Room Details" />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {!isCarpark && (
                <>
                  <DetailRow label="Room" value={(room as any).room_title || room.room} />
                  <DetailRow label="Room Type" value={(room as any).room_category || room.room_type} />
                  <DetailRow label="Unit Type" value={formatUnitType(room.unit_type_val)} />
                  <DetailRow label="Bed Type" value={room.bed_type} />
                  <DetailRow label="Wall Type" value={(room as any).wall_type} />
                  <div><span className="text-muted-foreground">Listed Rent:</span> <span className="font-medium">RM{room.rent}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={room.status} availableDate={room.available_date} /></div>
                  <DetailRow label="Available On" value={room.available_date} />
                  <div><span className="text-muted-foreground">Remaining Pax:</span> <span className="font-medium">{effectiveRemaining}</span></div>
                </>
              )}
              {isCarpark && (
                <>
                  <div><span className="text-muted-foreground">Listed Rent:</span> <span className="font-medium">RM{room.rent}</span></div>
                  <DetailRow label="Parking Lot" value={(room as any).parking_lot} />
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={room.status} availableDate={room.available_date} /></div>
                </>
              )}
              {feats.length > 0 && (
                <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Features:</span> <span className="font-medium">{feats.join(", ")}</span></div>
              )}
              {room.status === "Archived" && (room as any).archived_reason && (
                <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Archived Reason:</span> <span className="font-medium text-destructive">{(room as any).archived_reason}</span></div>
              )}
              {room.internal_only && (
                <div><span className="text-muted-foreground">Internal Only:</span> <span className="font-medium">Yes</span></div>
              )}
              {(room as any).internal_remark && (
                <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Remark:</span> <span className="font-medium">{(room as any).internal_remark}</span></div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Other Rooms in Unit */}
        {!isCarpark && otherRooms.length > 0 && (
          <AccordionItem value="summary" className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              <div className="flex items-center gap-2 flex-1"><span>Other Rooms in Unit</span></div>
              <div className="flex items-center gap-1 mr-2">
                <TextCopyBtn onClick={copyHousemateDetails} label="Copy Housemate Details" />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Room</TableHead>
                      <TableHead className="text-left">Status</TableHead>
                      <TableHead className="text-left">Tenant</TableHead>
                      <TableHead className="text-left">Gender</TableHead>
                      <TableHead className="text-left">Race</TableHead>
                      <TableHead className="text-left">Occupation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherRooms.map((r) => {
                      const housemates = Array.isArray(r.housemates) ? r.housemates : [];
                      const hmTenant = housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).name : (r as any).assigned_to;
                      const hmGender = r.tenant_gender || (housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).gender : "");
                      const hmRace = r.tenant_race || (housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).race : "");
                      const hmOccupation = housemates.length > 0 && typeof housemates[0] === "object" ? (housemates[0] as any).occupation : "";
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.room.replace(/^Room\s+/i, "")}</TableCell>
                          <TableCell><StatusBadge status={r.status} availableDate={r.available_date} /></TableCell>
                          <TableCell>{hmTenant || "N/A"}</TableCell>
                          <TableCell>{hmGender || "N/A"}</TableCell>
                          <TableCell>{hmRace || "N/A"}</TableCell>
                          <TableCell>{hmOccupation || "N/A"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 4. Tenant Details */}
        {showTenantSection && (
          <AccordionItem value="tenant" className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">Tenant Details</AccordionTrigger>
            <AccordionContent>
              {tenantLoading ? (
                <p className="text-sm text-muted-foreground">Loading tenant info…</p>
              ) : linkedTenant ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <DetailRow label="Name" value={linkedTenant.name} />
                  <DetailRow label="IC/Passport" value={linkedTenant.ic_passport} />
                  <DetailRow label="Phone" value={linkedTenant.phone} />
                  <DetailRow label="Email" value={linkedTenant.email} />
                  <DetailRow label="Gender" value={linkedTenant.gender} />
                  <DetailRow label="Nationality" value={linkedTenant.nationality} />
                  <DetailRow label="Race" value={linkedTenant.race} />
                  <DetailRow label="Occupation" value={linkedTenant.occupation} />
                  <DetailRow label="Company" value={linkedTenant.company} />
                  <DetailRow label="Position" value={linkedTenant.position} />
                  <DetailRow label="Car Plate" value={linkedTenant.car_plate} />
                  {linkedTenant.emergency_1_name && (
                    <div className="col-span-2 md:col-span-3 border-t pt-2 mt-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Emergency Contact 1</p>
                      <div className="grid grid-cols-3 gap-3">
                        <DetailRow label="Name" value={linkedTenant.emergency_1_name} />
                        <DetailRow label="Phone" value={linkedTenant.emergency_1_phone} />
                        <DetailRow label="Relationship" value={linkedTenant.emergency_1_relationship} />
                      </div>
                    </div>
                  )}
                  {linkedTenant.emergency_2_name && (
                    <div className="col-span-2 md:col-span-3 border-t pt-2 mt-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Emergency Contact 2</p>
                      <div className="grid grid-cols-3 gap-3">
                        <DetailRow label="Name" value={linkedTenant.emergency_2_name} />
                        <DetailRow label="Phone" value={linkedTenant.emergency_2_phone} />
                        <DetailRow label="Relationship" value={linkedTenant.emergency_2_relationship} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tenant linked to this {isCarpark ? "carpark" : "room"}.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {lightboxIndex !== null && <PhotoLightbox photos={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />}
    </div>
  );
}

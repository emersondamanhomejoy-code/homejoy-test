import { useState, useMemo, useEffect } from "react";
import { useUnits, useDeleteUnit, Unit } from "@/hooks/useRooms";
import { useLocations } from "@/hooks/useLocations";
import { useCondos } from "@/hooks/useCondos";
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
  onAddUnit: () => void;
}

export function UnitsRoomsContent({ onEditUnit, onAddUnit }: UnitsRoomsContentProps) {
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
        max_pets: (u as any).max_pets ?? 0,
        total_rooms: rooms.length,
        total_carparks: carparks.length,
        remaining_rooms: rooms.filter(r => r.status === "Available").length,
        remaining_carparks: carparks.filter(r => r.status === "Available").length,
        remaining_pets: (u as any).max_pets ?? 0, // placeholder
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
        <Button onClick={onAddUnit} size="sm">
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
                    <SortableTableHead sortKey="location" currentSort={sort} onSort={handleSort}>Location</SortableTableHead>
                    <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                    <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit Number</SortableTableHead>
                    <SortableTableHead sortKey="unit_type" currentSort={sort} onSort={handleSort}>Unit Type</SortableTableHead>
                    <SortableTableHead sortKey="max_pax" currentSort={sort} onSort={handleSort} className="text-center">Max Occupants</SortableTableHead>
                    <SortableTableHead sortKey="max_pets" currentSort={sort} onSort={handleSort} className="text-center">Max Pets</SortableTableHead>
                    <SortableTableHead sortKey="total_rooms" currentSort={sort} onSort={handleSort} className="text-center">Total Rooms</SortableTableHead>
                    <SortableTableHead sortKey="total_carparks" currentSort={sort} onSort={handleSort} className="text-center">Total Carparks</SortableTableHead>
                    <SortableTableHead sortKey="remaining_rooms" currentSort={sort} onSort={handleSort} className="text-center">Remaining Rooms</SortableTableHead>
                    <SortableTableHead sortKey="remaining_carparks" currentSort={sort} onSort={handleSort} className="text-center">Remaining Carparks</SortableTableHead>
                    <SortableTableHead sortKey="remaining_pets" currentSort={sort} onSort={handleSort} className="text-center">Remaining Pets</SortableTableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map(unit => {
                    const rooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
                    const carparks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
                    const availableRooms = rooms.filter(r => r.status === "Available").length;
                    const availableCarparks = carparks.filter(r => r.status === "Available").length;
                    const maxPets = (unit as any).max_pets ?? 0;
                    // Remaining pets = max_pets - count of occupied rooms with pets (placeholder: same as max for now)
                    const occupiedPets = rooms.filter(r => r.status === "Occupied").reduce((sum) => sum, 0); // no pet tracking per room yet
                    const remainingPets = maxPets;
                    const isExpanded = expandedRows.has(unit.id);

                    return (
                      <>
                        <TableRow key={unit.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleExpand(unit.id)}>
                          <TableCell className="w-10 px-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground">{unit.location || "—"}</TableCell>
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
                          <TableCell className="text-center">{maxPets}</TableCell>
                          <TableCell className="text-center">{rooms.length}</TableCell>
                          <TableCell className="text-center">{carparks.length}</TableCell>
                          <TableCell className="text-center">
                            <span className={availableRooms > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableRooms}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={availableCarparks > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableCarparks}</span>
                          </TableCell>
                          <TableCell className="text-center">{remainingPets}</TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewingUnit(unit)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => onEditUnit({
                                id: unit.id, building: unit.building, unit: unit.unit, location: unit.location,
                                unit_type: unit.unit_type, unit_max_pax: unit.unit_max_pax,
                                passcode: unit.passcode || "", access_card: unit.access_card || "",
                                parking_lot: (unit as any).parking_lot || "",
                                access_card_source: (unit as any).access_card_source || "Provided by Us",
                                access_card_deposit: (unit as any).access_card_deposit || 0,
                                access_info: typeof unit.access_info === 'string' ? unit.access_info : "",
                                internal_only: (unit as any).internal_only || false,
                                deposit: (unit as any).deposit || "",
                                meter_type: (unit as any).meter_type || "Postpaid",
                                meter_rate: (unit as any).meter_rate || 0,
                                deposit_multiplier: (unit as any).deposit_multiplier ?? 1.5,
                                admin_fee: (unit as any).admin_fee ?? 330,
                                parking_type: (unit as any).parking_type || "None",
                                parking_card_deposit: (unit as any).parking_card_deposit || 0,
                                common_photos: (unit as any).common_photos || [],
                                max_pets: (unit as any).max_pets ?? 0,
                              })}>
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
                            <TableCell colSpan={13} className="p-0">
                              <div className="px-8 py-3 space-y-1">
                                {(unit.rooms || []).length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2">No rooms configured.</div>
                                ) : (
                                  <div className="grid gap-1">
                                    <div className="grid grid-cols-[140px_120px_100px_80px_100px_120px_120px] text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 border-b border-border/50">
                                      <span>Room</span>
                                      <span>Type</span>
                                      <span>Bed Type</span>
                                      <span>Rent</span>
                                      <span>Status</span>
                                      <span>Tenant</span>
                                      <span>Gender / Race</span>
                                    </div>
                                    {(unit.rooms || []).map(room => (
                                      <div key={room.id} className="grid grid-cols-[140px_120px_100px_80px_100px_120px_120px] text-sm py-1.5 items-center">
                                        <span className="font-medium">{room.room}</span>
                                        <span className="text-muted-foreground">{room.room_type || "—"}</span>
                                        <span className="text-muted-foreground">{room.bed_type || "—"}</span>
                                        <span>RM{room.rent}</span>
                                        <span><StatusBadge status={room.status} /></span>
                                        <span className="text-muted-foreground truncate">
                                          {room.status === "Occupied" && room.housemates?.length
                                            ? (room.housemates as string[]).join(", ")
                                            : "—"}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {room.status === "Occupied"
                                            ? [room.tenant_gender, room.tenant_race].filter(Boolean).join(" / ") || "—"
                                            : "—"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Unit Details — {viewingUnit?.building} · {viewingUnit?.unit}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0 space-y-5 pb-4">
            {viewingUnit && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Location:</span> {viewingUnit.location}</div>
                  <div><span className="text-muted-foreground">Building:</span> {viewingUnit.building}</div>
                  <div><span className="text-muted-foreground">Unit:</span> {viewingUnit.unit}</div>
                  <div><span className="text-muted-foreground">Unit Type:</span> {viewingUnit.unit_type}</div>
                  <div><span className="text-muted-foreground">Max Occupants:</span> {viewingUnit.unit_max_pax}</div>
                  <div><span className="text-muted-foreground">Max Pets:</span> {(viewingUnit as any).max_pets ?? 0}</div>
                  <div><span className="text-muted-foreground">Rental Deposit:</span> {(viewingUnit as any).deposit_multiplier} months</div>
                  <div><span className="text-muted-foreground">Meter Type:</span> {(viewingUnit as any).meter_type}</div>
                  <div><span className="text-muted-foreground">Meter Rate:</span> {(viewingUnit as any).meter_rate}</div>
                  <div><span className="text-muted-foreground">Admin Fee:</span> RM{(viewingUnit as any).admin_fee}</div>
                  <div><span className="text-muted-foreground">Passcode:</span> {viewingUnit.passcode || "—"}</div>
                  <div><span className="text-muted-foreground">Parking Type:</span> {(viewingUnit as any).parking_type || "—"}</div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Rooms</div>
                  {(viewingUnit.rooms || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No rooms.</div>
                  ) : (
                    <div className="space-y-2">
                      {(viewingUnit.rooms || []).map(room => (
                        <div key={room.id} className="bg-muted/30 rounded-lg p-3 text-sm grid grid-cols-3 gap-2">
                          <div><span className="text-muted-foreground">Room:</span> {room.room}</div>
                          <div><span className="text-muted-foreground">Type:</span> {room.room_type}</div>
                          <div><span className="text-muted-foreground">Bed:</span> {room.bed_type || "—"}</div>
                          <div><span className="text-muted-foreground">Rent:</span> RM{room.rent}</div>
                          <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={room.status} /></div>
                          <div><span className="text-muted-foreground">Max Pax:</span> {room.max_pax}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

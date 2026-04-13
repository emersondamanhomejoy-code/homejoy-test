import { useState, useMemo, useEffect } from "react";
import { useUnits, useDeleteUnit, Unit } from "@/hooks/useRooms";
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
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { labelClass } from "@/lib/ui-constants";

export function UnitsRoomsContent() {
  const { data: units = [], isLoading } = useUnits();
  const deleteUnit = useDeleteUnit();

  const [search, setSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnitType, setSelectedUnitType] = useState<string>("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const { sort, handleSort, sortData } = useTableSort("building");

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
      const occupiedPax = rooms.reduce((sum, r) => sum + (r.pax_staying || 0), 0);
      const map: Record<string, any> = {
        location: u.location,
        building: u.building,
        unit: u.unit,
        unit_type: u.unit_type,
        max_pax: u.unit_max_pax,
        remaining_pax: u.unit_max_pax - occupiedPax,
        remaining_rooms: rooms.filter(r => r.status === "Available").length,
        remaining_carparks: carparks.filter(r => r.status === "Available").length,
      };
      return map[key];
    });
  }, [units, search, selectedLocations, selectedBuildings, selectedUnitType, sort]);

  useEffect(() => { setCurrentPage(0); }, [search, selectedLocations, selectedBuildings, selectedUnitType, pageSize]);

  const paginatedRows = useMemo(() => {
    const start = currentPage * pageSize;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Units</h2>
        <Button onClick={() => setAddUnitOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Unit
        </Button>
      </div>

      {/* Filters */}
      <StandardFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setCurrentPage(0); }}
        placeholder="Search by building, unit, location..."
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
      >
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
          <label className={labelClass}>Unit Type</label>
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
      </StandardFilterBar>

      {/* Table */}
      <StandardTable
        columns={
          <TableRow className="bg-muted/30">
            <TableHead className="w-10" />
            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
            <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
            <SortableTableHead sortKey="unit_type" currentSort={sort} onSort={handleSort}>Type</SortableTableHead>
            <SortableTableHead sortKey="max_pax" currentSort={sort} onSort={handleSort} className="text-center">Max Occupants</SortableTableHead>
            <SortableTableHead sortKey="remaining_pax" currentSort={sort} onSort={handleSort} className="text-center">Remaining Pax</SortableTableHead>
            <SortableTableHead sortKey="remaining_rooms" currentSort={sort} onSort={handleSort} className="text-center">Remaining Rooms</SortableTableHead>
            <SortableTableHead sortKey="remaining_carparks" currentSort={sort} onSort={handleSort} className="text-center">Remaining Carparks</SortableTableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        }
        isEmpty={filteredRows.length === 0}
        emptyMessage="No units match your filters."
        total={filteredRows.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        showCount
        countLabel="units"
      >
        {paginatedRows.map(unit => {
          const rooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
          const carparks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
          const availableRooms = rooms.filter(r => r.status === "Available").length;
          const availableCarparks = carparks.filter(r => r.status === "Available").length;
          const occupiedPax = rooms.reduce((sum, r) => sum + (r.pax_staying || 0), 0);
          const remainingPax = unit.unit_max_pax - occupiedPax;
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
                  <span className={remainingPax > 0 ? "text-emerald-600 font-semibold" : remainingPax === 0 ? "text-muted-foreground" : "text-destructive font-semibold"}>{remainingPax}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={availableRooms > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableRooms}</span>
                  <span className="text-muted-foreground">/{rooms.length}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={availableCarparks > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{availableCarparks}</span>
                  <span className="text-muted-foreground">/{carparks.length}</span>
                </TableCell>
                <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                  <ActionButtons actions={[
                    { type: "view", onClick: () => setViewingUnit(unit) },
                    { type: "edit", onClick: () => setEditUnitId(unit.id) },
                    { type: "delete", onClick: () => setDeleteConfirm(unit.id) },
                  ]} />
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${unit.id}-expand`} className="bg-muted/10">
                  <TableCell colSpan={11} className="p-0">
                    <div className="px-8 py-3 space-y-4">
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
                                <div className="overflow-x-auto rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Room</TableHead>
                                        <TableHead>Bed Type</TableHead>
                                        <TableHead>Wall Type</TableHead>
                                        <TableHead>Features</TableHead>
                                        <TableHead className="text-center">Max Pax</TableHead>
                                        <TableHead className="text-right">Rental (RM)</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Pax Staying</TableHead>
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
                                            <TableCell>
                                              <div className="flex flex-wrap gap-1">
                                                {feats.length > 0 ? feats.map((f: string) => (
                                                  <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                                                )) : <span className="text-muted-foreground">—</span>}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center">{room.max_pax}</TableCell>
                                            <TableCell className="text-right">{room.rent}</TableCell>
                                            <TableCell><StatusBadge status={room.status} availableDate={room.available_date} /></TableCell>
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
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Carparks</div>
                                <div className="overflow-x-auto rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Carpark Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Remark</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {unitCarparks.map(cp => (
                                        <TableRow key={cp.id}>
                                          <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                                          <TableCell><StatusBadge status={cp.status} /></TableCell>
                                          <TableCell>{(cp as any).assigned_to || "—"}</TableCell>
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
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </StandardTable>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={open => { if (!open) setDeleteConfirm(null); }}
        title="Delete this unit?"
        description="This will permanently delete the unit and all its rooms. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

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
                                  <TableCell><StatusBadge status={room.status} availableDate={room.available_date} /></TableCell>
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

      {/* Add Unit Modal */}
      <AddUnit open={addUnitOpen} onOpenChange={setAddUnitOpen} />

      {/* Edit Unit Modal */}
      {editUnitId && (
        <EditUnit
          open={true}
          onOpenChange={(o) => { if (!o) setEditUnitId(null); }}
          unitId={editUnitId}
        />
      )}
    </div>
  );
}

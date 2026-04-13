import { useState, useMemo, useEffect } from "react";
import { useUnits, useDeleteUnit, Unit, Room } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { useAuth } from "@/hooks/useAuth";
import AddUnit from "@/pages/AddUnit";
import EditUnit from "@/pages/EditUnit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Plus, Copy, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { StandardModal } from "@/components/ui/standard-modal";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { labelClass, inputClass } from "@/lib/ui-constants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

export function UnitsRoomsContent() {
  const { data: units = [], isLoading } = useUnits();
  const { data: condosData = [] } = useCondos();
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const deleteUnit = useDeleteUnit();

  const [search, setSearch] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [selectedUnitType, setSelectedUnitType] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const { sort, handleSort, sortData } = useTableSort("building");

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [internalOnly, setInternalOnly] = useState("");
  const [hasRemainingRooms, setHasRemainingRooms] = useState("");
  const [hasRemainingCarparks, setHasRemainingCarparks] = useState("");
  const [maxOccupantsMin, setMaxOccupantsMin] = useState("");
  const [maxOccupantsMax, setMaxOccupantsMax] = useState("");
  const [remainingPaxMin, setRemainingPaxMin] = useState("");
  const [remainingPaxMax, setRemainingPaxMax] = useState("");

  const locations = useMemo(() => {
    const set = new Set(units.map(u => u.location).filter(Boolean));
    return Array.from(set).sort();
  }, [units]);

  const buildings = useMemo(() => {
    const source = selectedLocation !== "all"
      ? units.filter(u => u.location === selectedLocation)
      : units;
    const set = new Set(source.map(u => u.building).filter(Boolean));
    return Array.from(set).sort();
  }, [units, selectedLocation]);

  const getUnitStats = (u: Unit) => {
    const rooms = u.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
    const carparks = u.rooms?.filter(r => r.room_type === "Car Park") ?? [];
    const occupiedPax = rooms.reduce((sum, r) => sum + (r.pax_staying || 0), 0);
    return {
      rooms,
      carparks,
      availableRooms: rooms.filter(r => r.status === "Available").length,
      availableCarparks: carparks.filter(r => r.status === "Available").length,
      occupiedPax,
      remainingPax: u.unit_max_pax - occupiedPax,
    };
  };

  const filteredRows = useMemo(() => {
    let list = units;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.building.toLowerCase().includes(q) ||
        u.unit.toLowerCase().includes(q)
      );
    }
    if (selectedBuilding !== "all") list = list.filter(u => u.building === selectedBuilding);
    if (selectedUnitType !== "all") list = list.filter(u => u.unit_type?.toLowerCase().includes(selectedUnitType));
    if (selectedLocation !== "all") list = list.filter(u => u.location === selectedLocation);
    if (internalOnly === "yes") list = list.filter(u => u.internal_only);
    if (internalOnly === "no") list = list.filter(u => !u.internal_only);

    list = list.filter(u => {
      const s = getUnitStats(u);
      if (hasRemainingRooms === "yes" && s.availableRooms === 0) return false;
      if (hasRemainingRooms === "no" && s.availableRooms > 0) return false;
      if (hasRemainingCarparks === "yes" && s.availableCarparks === 0) return false;
      if (hasRemainingCarparks === "no" && s.availableCarparks > 0) return false;
      if (maxOccupantsMin && u.unit_max_pax < Number(maxOccupantsMin)) return false;
      if (maxOccupantsMax && u.unit_max_pax > Number(maxOccupantsMax)) return false;
      if (remainingPaxMin && s.remainingPax < Number(remainingPaxMin)) return false;
      if (remainingPaxMax && s.remainingPax > Number(remainingPaxMax)) return false;
      return true;
    });

    return sortData(list, (u: Unit, key: string) => {
      const s = getUnitStats(u);
      const map: Record<string, any> = {
        building: u.building,
        unit: u.unit,
        unit_type: u.unit_type,
        max_pax: u.unit_max_pax,
        remaining_pax: s.remainingPax,
        remaining_rooms: s.availableRooms,
        remaining_carparks: s.availableCarparks,
      };
      return map[key];
    });
  }, [units, search, selectedBuilding, selectedUnitType, selectedLocation, internalOnly, hasRemainingRooms, hasRemainingCarparks, maxOccupantsMin, maxOccupantsMax, remainingPaxMin, remainingPaxMax, sort]);

  useEffect(() => { setCurrentPage(0); }, [search, selectedBuilding, selectedUnitType, selectedLocation, internalOnly, hasRemainingRooms, hasRemainingCarparks, maxOccupantsMin, maxOccupantsMax, remainingPaxMin, remainingPaxMax, pageSize]);

  const paginatedRows = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const hasFilters = selectedBuilding !== "all" || selectedUnitType !== "all" || selectedLocation !== "all" || !!internalOnly || !!hasRemainingRooms || !!hasRemainingCarparks || !!maxOccupantsMin || !!maxOccupantsMax || !!remainingPaxMin || !!remainingPaxMax;

  const clearFilters = () => {
    setSelectedBuilding("all");
    setSelectedUnitType("all");
    setSelectedLocation("all");
    setInternalOnly("");
    setHasRemainingRooms("");
    setHasRemainingCarparks("");
    setMaxOccupantsMin("");
    setMaxOccupantsMax("");
    setRemainingPaxMin("");
    setRemainingPaxMax("");
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
        placeholder="Search by building or unit..."
        hasActiveFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <div className="space-y-1.5 min-w-[160px]">
          <label className={labelClass}>Building</label>
          <select className={inputClass} value={selectedBuilding} onChange={e => setSelectedBuilding(e.target.value)}>
            <option value="all">All Buildings</option>
            {buildings.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 min-w-[160px]">
          <label className={labelClass}>Unit Type</label>
          <select className={inputClass} value={selectedUnitType} onChange={e => setSelectedUnitType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="mix">Mix Unit</option>
            <option value="female">Female Unit</option>
            <option value="male">Male Unit</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdvanced(v => !v)} className="text-sm self-end">
          {showAdvanced ? "Hide" : "Show"} Advanced Filters
        </Button>
        {showAdvanced && (
          <>
            <div className="space-y-1.5 min-w-[160px]">
              <label className={labelClass}>Location</label>
              <select className={inputClass} value={selectedLocation} onChange={e => {
                setSelectedLocation(e.target.value);
                if (e.target.value !== "all" && selectedBuilding !== "all") {
                  const valid = units.filter(u => u.location === e.target.value).map(u => u.building);
                  if (!valid.includes(selectedBuilding)) setSelectedBuilding("all");
                }
              }}>
                <option value="all">All Locations</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Internal Only</label>
              <select className={inputClass} value={internalOnly} onChange={e => setInternalOnly(e.target.value)}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Has Remaining Rooms</label>
              <select className={inputClass} value={hasRemainingRooms} onChange={e => setHasRemainingRooms(e.target.value)}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className={labelClass}>Has Remaining Carparks</label>
              <select className={inputClass} value={hasRemainingCarparks} onChange={e => setHasRemainingCarparks(e.target.value)}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[120px]">
              <label className={labelClass}>Max Occupants</label>
              <div className="flex gap-1">
                <input type="number" placeholder="Min" className={`${inputClass} w-16`} value={maxOccupantsMin} onChange={e => setMaxOccupantsMin(e.target.value)} />
                <input type="number" placeholder="Max" className={`${inputClass} w-16`} value={maxOccupantsMax} onChange={e => setMaxOccupantsMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 min-w-[120px]">
              <label className={labelClass}>Remaining Pax</label>
              <div className="flex gap-1">
                <input type="number" placeholder="Min" className={`${inputClass} w-16`} value={remainingPaxMin} onChange={e => setRemainingPaxMin(e.target.value)} />
                <input type="number" placeholder="Max" className={`${inputClass} w-16`} value={remainingPaxMax} onChange={e => setRemainingPaxMax(e.target.value)} />
              </div>
            </div>
          </>
        )}
      </StandardFilterBar>

      {/* Table — no accordion, flat rows */}
      <StandardTable
        columns={
          <TableRow className="bg-muted/30">
            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
            <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
            <SortableTableHead sortKey="unit_type" currentSort={sort} onSort={handleSort}>Type</SortableTableHead>
            <SortableTableHead sortKey="internal_only" currentSort={sort} onSort={handleSort} className="text-center">Internal</SortableTableHead>
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
          const s = getUnitStats(unit);
          return (
            <TableRow key={unit.id} className="hover:bg-muted/30">
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
              <TableCell className="text-center">
                {unit.internal_only ? (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">No</span>
                )}
              </TableCell>
              <TableCell className="text-center">{unit.unit_max_pax}</TableCell>
              <TableCell className="text-center">
                <span className={s.remainingPax > 0 ? "text-emerald-600 font-semibold" : s.remainingPax === 0 ? "text-muted-foreground" : "text-destructive font-semibold"}>{s.remainingPax}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className={s.availableRooms > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{s.availableRooms}</span>
                <span className="text-muted-foreground">/{s.rooms.length}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className={s.availableCarparks > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{s.availableCarparks}</span>
                <span className="text-muted-foreground">/{s.carparks.length}</span>
              </TableCell>
              <TableCell className="text-center">
                <ActionButtons actions={[
                  { type: "view", onClick: () => setViewingUnit(unit) },
                  { type: "edit", onClick: () => setEditUnitId(unit.id) },
                  { type: "delete", onClick: () => setDeleteConfirm(unit.id) },
                ]} />
              </TableCell>
            </TableRow>
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

      {/* View Details Modal */}
      <StandardModal
        open={!!viewingUnit}
        onOpenChange={open => { if (!open) setViewingUnit(null); }}
        title={`Unit Details — ${viewingUnit?.building} · ${viewingUnit?.unit}`}
        size="lg"
        hideCancel
        footer={<Button variant="outline" onClick={() => setViewingUnit(null)}>Close</Button>}
      >
        {viewingUnit && (() => {
          const unitRooms = (viewingUnit.rooms || []).filter(r => r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark"));
          const unitCarparks = (viewingUnit.rooms || []).filter(r => r.room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark"));
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const occupiedPax = unitRooms.reduce((sum, r) => sum + (r.pax_staying || 0), 0);
          const remainingPax = viewingUnit.unit_max_pax - occupiedPax;
          const occupiedCarparks = unitCarparks.filter(r => r.status === "Occupied").length;

          return (
            <div className="space-y-6">
              {/* Building Summary */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Building Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Building:</span> <span className="font-medium">{viewingUnit.building}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{viewingUnit.location}</span></div>
                </div>
                {((viewingUnit as any).common_photos || []).length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {((viewingUnit as any).common_photos as string[]).map((path: string, i: number) => (
                      <img key={i} src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
              </section>

              {/* Unit Details */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unit Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
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
              </section>

              {/* Occupant Summary */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Occupant Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{occupiedPax}</div>
                    <div className="text-xs text-muted-foreground">Current Occupied</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{viewingUnit.unit_max_pax}</div>
                    <div className="text-xs text-muted-foreground">Max Pax</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold ${remainingPax > 0 ? "text-emerald-600" : remainingPax === 0 ? "" : "text-destructive"}`}>{remainingPax}</div>
                    <div className="text-xs text-muted-foreground">Remaining Pax</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{occupiedCarparks}</div>
                    <div className="text-xs text-muted-foreground">Occupied Carparks</div>
                  </div>
                </div>

                {/* Housemate summary table */}
                {unitRooms.filter(r => r.status === "Occupied" && r.pax_staying > 0).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Current Housemates</div>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Room</TableHead>
                            <TableHead>Tenant Name</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Nationality</TableHead>
                            <TableHead>Occupation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unitRooms.filter(r => r.status === "Occupied" && r.pax_staying > 0).map(r => {
                            const housemates = Array.isArray(r.housemates) ? r.housemates : [];
                            if (housemates.length > 0) {
                              return housemates.map((h: any, hi: number) => (
                                <TableRow key={`${r.id}-${hi}`}>
                                  {hi === 0 && <TableCell rowSpan={housemates.length} className="font-medium align-top">{r.room}</TableCell>}
                                  <TableCell>{typeof h === "string" ? h : h?.name || "—"}</TableCell>
                                  <TableCell>{typeof h === "object" ? h?.gender || r.tenant_gender || "—" : r.tenant_gender || "—"}</TableCell>
                                  <TableCell>{typeof h === "object" ? h?.nationality || "—" : "—"}</TableCell>
                                  <TableCell>{typeof h === "object" ? h?.occupation || "—" : "—"}</TableCell>
                                </TableRow>
                              ));
                            }
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.room}</TableCell>
                                <TableCell>{r.pax_staying} pax</TableCell>
                                <TableCell>{r.tenant_gender || "—"}</TableCell>
                                <TableCell>—</TableCell>
                                <TableCell>—</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Occupied carparks summary */}
                {unitCarparks.filter(r => r.status === "Occupied").length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Occupied Carparks</div>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Remark</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unitCarparks.filter(r => r.status === "Occupied").map(cp => (
                            <TableRow key={cp.id}>
                              <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                              <TableCell>{(cp as any).assigned_to || "—"}</TableCell>
                              <TableCell>{(cp as any).internal_remark || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </section>

              {/* Rooms Summary */}
              {unitRooms.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rooms Summary</h3>
                  <div className="overflow-x-auto rounded-lg border">
                     <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Room Title</TableHead>
                          <TableHead className="text-right">Rental</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Pax</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unitRooms.map(room => (
                          <TableRow key={room.id}>
                            <TableCell className="font-medium">{room.room.replace(/^Room\s+/i, "")}</TableCell>
                            <TableCell>{(room as any).room_title || <span className="text-muted-foreground italic">—</span>}</TableCell>
                            <TableCell className="text-right">RM{room.rent}</TableCell>
                            <TableCell><StatusBadge status={room.status} availableDate={room.available_date} /></TableCell>
                            <TableCell className="text-center">{room.pax_staying || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Carparks Summary */}
              {unitCarparks.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Carparks Summary</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Lot</TableHead>
                          <TableHead className="text-right">Rental</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned To</TableHead>
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
                            <TableCell>{(cp as any).assigned_to || "—"}</TableCell>
                            <TableCell>{(cp as any).internal_remark || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}
            </div>
          );
        })()}
      </StandardModal>

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

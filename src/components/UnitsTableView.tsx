import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Unit } from "@/hooks/useRooms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, X, Pencil, Trash2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UnitsTableViewProps {
  units: Unit[];
  unitsLoading: boolean;
  unitFilters: { location: string; building: string; price: string; unitType: string };
  setUnitFilters: (f: any) => void;
  openCreateRoom2: () => void;
  setEditingUnit: (u: any) => void;
  handleDeleteUnit: (id: string) => void;
  condosList: any[];
  inputClass: string;
  emptyUnit: any;
}

export function UnitsTableView({
  units, unitsLoading, unitFilters, setUnitFilters,
  openCreateRoom2, setEditingUnit, handleDeleteUnit,
  condosList, inputClass, emptyUnit,
}: UnitsTableViewProps) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedUnitType, setSelectedUnitType] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);

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

  // Flatten units → rooms for table display
  const allRows = useMemo(() => {
    let list = units;
    if (selectedLocations.length) list = list.filter(u => selectedLocations.includes(u.location));
    if (selectedBuildings.length) list = list.filter(u => selectedBuildings.includes(u.building));
    if (selectedUnitType !== "all") list = list.filter(u => u.unit_type?.toLowerCase().includes(selectedUnitType));
    return list;
  }, [units, selectedLocations, selectedBuildings, selectedUnitType]);

  useEffect(() => { setCurrentPage(1); }, [selectedLocations, selectedBuildings, selectedUnitType, pageSize]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allRows.slice(start, start + pageSize);
  }, [allRows, currentPage, pageSize]);

  const applyLocations = (next: string[]) => {
    setSelectedLocations(next);
    if (next.length) {
      setSelectedBuildings(prev => {
        const valid = new Set(units.filter(u => next.includes(u.location)).map(u => u.building));
        return prev.filter(b => valid.has(b));
      });
    }
  };

  const hasFilters = selectedLocations.length > 0 || selectedBuildings.length > 0 || selectedUnitType !== "all";

  const clearFilters = () => {
    setSelectedLocations([]);
    setSelectedBuildings([]);
    setSelectedUnitType("all");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5">
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
            label="Building / Condo"
            placeholder="Select building"
            options={buildings}
            selected={selectedBuildings}
            onApply={(next) => setSelectedBuildings(next)}
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
          <div className="flex flex-wrap gap-2 mt-3">
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
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="font-semibold text-foreground">
            Units & Rooms <span className="text-muted-foreground font-normal text-sm ml-2">({allRows.length} units)</span>
          </h3>
          <Button onClick={openCreateRoom2} size="sm">+ Add Unit and Rooms</Button>
        </div>

        {unitsLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading units…</div>
        ) : allRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No units match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                 <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Location</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead className="text-center">Max Pax</TableHead>
                    <TableHead className="text-center">Rooms</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUnits.map((unit) => {
                    const regularRooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
                    const carParks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
                    const availableCount = regularRooms.filter(r => r.status === "Available").length;
                    const availableCP = carParks.filter(r => r.status === "Available").length;

                    return (
                      <TableRow key={unit.id} className="hover:bg-muted/30">
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
                        <TableCell className="text-center">{regularRooms.length}{carParks.length > 0 && ` + ${carParks.length}🅿️`}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-emerald-600 font-semibold">{availableCount}</span>
                          {carParks.length > 0 && <span className="text-muted-foreground text-xs ml-1">({availableCP}🅿️)</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details" onClick={() => setViewingUnit(unit)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditingUnit({
                                id: unit.id, building: unit.building, unit: unit.unit, location: unit.location,
                                unit_type: unit.unit_type, unit_max_pax: unit.unit_max_pax,
                                passcode: unit.passcode || "", access_card: unit.access_card || "",
                                parking_lot: unit.parking_lot || "",
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
                              });
                            }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUnit(unit.id)}>
                              <Trash2 className="h-4 w-4" />
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
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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

      {/* View Details Dialog */}
      <Dialog open={!!viewingUnit} onOpenChange={(open) => { if (!open) setViewingUnit(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Unit Details — {viewingUnit?.building} · {viewingUnit?.unit}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0 space-y-5 pb-4">
            {viewingUnit && (
              <>
                {/* Common Area Photos */}
                <div>
                  <div className="text-sm font-semibold mb-2">🏠 Common Area Photos</div>
                  {((viewingUnit as any).common_photos as string[] || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No common area photos uploaded.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {((viewingUnit as any).common_photos as string[] || []).map((path: string, i: number) => (
                        <div key={i} className="relative group">
                          <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-28 w-full object-cover rounded-lg" />
                          <button
                            className="absolute bottom-1 right-1 bg-background/80 text-foreground rounded px-2 py-0.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`;
                              navigator.clipboard.writeText(url);
                              alert("Photo link copied!");
                            }}
                          >📋 Copy Link</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unit Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Location:</span> {viewingUnit.location}</div>
                  <div><span className="text-muted-foreground">Building:</span> {viewingUnit.building}</div>
                  <div><span className="text-muted-foreground">Unit:</span> {viewingUnit.unit}</div>
                  <div><span className="text-muted-foreground">Unit Type:</span> {viewingUnit.unit_type}</div>
                  <div><span className="text-muted-foreground">Max Pax:</span> {viewingUnit.unit_max_pax}</div>
                  <div><span className="text-muted-foreground">Rental Deposit:</span> {(viewingUnit as any).deposit_multiplier} months</div>
                  <div><span className="text-muted-foreground">Meter Type:</span> {(viewingUnit as any).meter_type}</div>
                  <div><span className="text-muted-foreground">Meter Rate:</span> {(viewingUnit as any).meter_rate}</div>
                  <div><span className="text-muted-foreground">Admin Fee:</span> RM{(viewingUnit as any).admin_fee}</div>
                  <div><span className="text-muted-foreground">Passcode:</span> {viewingUnit.passcode || "—"}</div>
                  {(viewingUnit as any).internal_only && <div className="col-span-2"><Badge variant="secondary" className="bg-primary/20 text-primary">🔒 Internal Only</Badge></div>}
                </div>

                {/* Rooms summary */}
                <div>
                  <div className="text-sm font-semibold mb-2">Rooms ({viewingUnit.rooms?.length || 0})</div>
                  <div className="space-y-1 text-sm">
                    {viewingUnit.rooms?.map(room => (
                      <div key={room.id} className="flex items-center gap-3 py-1 border-b border-border/50 last:border-0">
                        <span className="font-medium w-24">{room.room_type === "Car Park" ? `🅿️ ${room.room}` : room.room}</span>
                        <span className="text-muted-foreground w-24">{room.bed_type || "—"}</span>
                        <span className="w-16">RM{room.rent}</span>
                        <StatusBadge status={room.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
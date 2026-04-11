import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Unit, Room } from "@/hooks/useRooms";
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
import { ChevronLeft, ChevronRight, X, Pencil, Trash2, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UnitsTableViewProps {
  units: Unit[];
  unitsLoading: boolean;
  unitFilters: { location: string; building: string; price: string; unitType: string };
  setUnitFilters: (f: any) => void;
  openCreateRoom2: () => void;
  setEditingUnit: (u: any) => void;
  handleDeleteUnit: (id: string) => void;
  setEditingRoom: (r: Room) => void;
  expandedUnit: string | null;
  setExpandedUnit: (id: string | null) => void;
  updateRoom: any;
  updateUnit: any;
  createRoom: any;
  deleteRoom: any;
  changeRoomStatus: (room: Room, status: string) => void;
  changeRoomAvailableDate: (room: Room, date: string) => void;
  condosList: any[];
  inputClass: string;
  emptyUnit: any;
}

export function UnitsTableView({
  units, unitsLoading, unitFilters, setUnitFilters,
  openCreateRoom2, setEditingUnit, handleDeleteUnit,
  setEditingRoom, expandedUnit, setExpandedUnit,
  updateRoom, updateUnit, createRoom, deleteRoom,
  changeRoomStatus, changeRoomAvailableDate,
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead className="text-center">Max Pax</TableHead>
                    <TableHead className="text-center">Rooms</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead>Info</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUnits.map((unit) => {
                    const isExpanded = expandedUnit === unit.id;
                    const regularRooms = unit.rooms?.filter(r => r.room_type !== "Car Park") ?? [];
                    const carParks = unit.rooms?.filter(r => r.room_type === "Car Park") ?? [];
                    const availableCount = regularRooms.filter(r => r.status === "Available").length;
                    const availableCP = carParks.filter(r => r.status === "Available").length;

                    return (
                      <>
                        <TableRow key={unit.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}>
                          <TableCell className="px-2">
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
                          <TableCell className="text-center">{regularRooms.length}{carParks.length > 0 && ` + ${carParks.length}🅿️`}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-semibold">{availableCount}</span>
                            {carParks.length > 0 && <span className="text-muted-foreground text-xs ml-1">({availableCP}🅿️)</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {unit.passcode && <Badge variant="outline" className="text-[10px]">🔑 {unit.passcode}</Badge>}
                              {(unit as any).internal_only && <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">🔒 Internal</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-1 justify-center" onClick={e => e.stopPropagation()}>
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

                        {/* Expanded: show rooms */}
                        {isExpanded && unit.rooms && (
                          <>
                            {/* Common Photos row */}
                            <TableRow className="bg-secondary/20">
                              <TableCell colSpan={10} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-sm font-semibold">🏠 Common Area Photos</div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => {
                                      const url = `${window.location.origin}/common/${unit.id}`;
                                      navigator.clipboard.writeText(url);
                                      alert("Common area link copied!");
                                    }}>📋 Copy Link</Button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {((unit as any).common_photos as string[] || []).map((path: string, i: number) => (
                                    <div key={i} className="relative group">
                                      <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-24 w-24 object-cover rounded-lg" />
                                      <button onClick={async () => {
                                        const newPhotos = ((unit as any).common_photos as string[]).filter((_: string, idx: number) => idx !== i);
                                        try { await updateUnit.mutateAsync({ id: unit.id, common_photos: newPhotos } as any); } catch (e: any) { alert(e.message); }
                                      }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                    </div>
                                  ))}
                                  <label className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                    <span className="text-xl text-muted-foreground">+</span>
                                    <span className="text-[10px] text-muted-foreground">Add</span>
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (!files.length) return;
                                      const newPaths: string[] = [];
                                      for (const file of files) {
                                        const ext = file.name.split('.').pop();
                                        const path = `common/${unit.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                                        const { error } = await supabase.storage.from("room-photos").upload(path, file);
                                        if (error) { alert(`Upload failed: ${error.message}`); continue; }
                                        newPaths.push(path);
                                      }
                                      if (newPaths.length > 0) {
                                        const existing = ((unit as any).common_photos as string[] || []);
                                        try { await updateUnit.mutateAsync({ id: unit.id, common_photos: [...existing, ...newPaths] } as any); } catch (e: any) { alert(e.message); }
                                      }
                                      e.target.value = "";
                                    }} />
                                  </label>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Room sub-rows */}
                            <TableRow className="bg-muted/20">
                              <TableCell></TableCell>
                              <TableCell colSpan={9} className="p-0">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-secondary/50">
                                      <th className="text-left px-4 py-2 font-medium">Room</th>
                                      <th className="text-left px-4 py-2 font-medium">Bed Type</th>
                                      <th className="text-left px-4 py-2 font-medium">Pax</th>
                                      <th className="text-left px-4 py-2 font-medium">Rent</th>
                                      <th className="text-left px-4 py-2 font-medium">Tenant</th>
                                      <th className="text-left px-4 py-2 font-medium">Status</th>
                                      <th className="text-right px-4 py-2 font-medium">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {unit.rooms.map((room) => {
                                      const isCP = room.room_type === "Car Park";
                                      return (
                                        <tr key={room.id} className={`border-t hover:bg-secondary/30 transition-colors ${isCP ? "bg-blue-500/5" : ""}`}>
                                          <td className="px-4 py-3 font-medium">{isCP ? `🅿️ ${room.room}` : room.room}</td>
                                          <td className="px-4 py-3 text-muted-foreground">{isCP ? (room.bed_type ? `Lot: ${room.bed_type}` : "—") : (room.bed_type || "—")}</td>
                                          <td className="px-4 py-3">
                                            {isCP ? "—" : (
                                              <select className="bg-secondary rounded px-2 py-1 text-xs font-medium" value={room.pax_staying || 0} onChange={async (e) => {
                                                try { await updateRoom.mutateAsync({ id: room.id, pax_staying: Number(e.target.value) }); } catch (err: any) { alert(err.message); }
                                              }}>
                                                {Array.from({ length: room.max_pax + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                                              </select>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">{room.rent > 0 ? `RM${room.rent}` : "—"}</td>
                                          <td className="px-4 py-3 text-muted-foreground">{isCP ? (room.tenant_gender || "—") : ([room.tenant_race, room.tenant_gender].filter(Boolean).join(" ") || "—")}</td>
                                          <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                              <select
                                                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                                  room.status === "Available" ? "bg-emerald-100 text-emerald-700" :
                                                  room.status === "Available Soon" ? "bg-sky-100 text-sky-700" :
                                                  room.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                                  room.status === "Occupied" ? "bg-red-100 text-red-700" :
                                                  "bg-muted text-muted-foreground"
                                                }`}
                                                value={room.status}
                                                onChange={e => changeRoomStatus(room, e.target.value)}
                                              >
                                                <option value="Available">Available</option>
                                                <option value="Available Soon">Available Soon</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Occupied">Occupied</option>
                                              </select>
                                              {room.status === "Available Soon" && (
                                                <input type="date" className="px-1.5 py-0.5 rounded border bg-secondary text-xs"
                                                  value={room.available_date !== "Available Now" ? room.available_date : ""}
                                                  onChange={e => changeRoomAvailableDate(room, e.target.value)}
                                                />
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex gap-1 justify-end">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoom(room)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                              {isCP && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                                                  if (confirm("Delete this car park?")) {
                                                    try { await deleteRoom.mutateAsync(room.id); } catch (e: any) { alert(e.message); }
                                                  }
                                                }}>
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="border-t bg-secondary/30 font-semibold">
                                      <td className="px-4 py-2" colSpan={2}>Balance Pax</td>
                                      <td className="px-4 py-2">{unit.unit_max_pax - (unit.rooms?.filter(r => r.room_type !== "Car Park").reduce((sum, r) => sum + (r.pax_staying || 0), 0) ?? 0)}</td>
                                      <td colSpan={4} className="px-4 py-2 text-right">
                                        <Button variant="outline" size="sm" disabled={createRoom.isPending} onClick={async () => {
                                          const cpCount = (unit.rooms?.filter(r => r.room_type === "Car Park").length ?? 0) + 1;
                                          try {
                                            await createRoom.mutateAsync({
                                              unit_id: unit.id, building: unit.building, unit: unit.unit,
                                              room: cpCount === 1 ? "Car Park" : `Car Park ${cpCount}`,
                                              location: unit.location, rent: 0, bed_type: "", room_type: "Car Park",
                                              unit_type: unit.unit_type, status: "Available", available_date: "Available Now",
                                              max_pax: 0, occupied_pax: 0, pax_staying: 0, unit_max_pax: unit.unit_max_pax,
                                              unit_occupied_pax: 0, housemates: [], photos: [], access_info: unit.access_info,
                                              move_in_cost: { advance: 0, deposit: 0, accessCard: 0, moveInFee: 0, total: 0 },
                                              tenant_gender: "", tenant_race: "",
                                              internal_only: (unit as any).internal_only || false,
                                            });
                                          } catch (e: any) { alert(e.message); }
                                        }}>
                                          🅿️ + Add Car Park
                                        </Button>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </TableCell>
                            </TableRow>
                          </>
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
    </div>
  );
}
import { useState, useMemo, useEffect } from "react";
import { formatUnitType } from "@/lib/ui-constants";
import { useUnits, useDeleteUnit, Unit, Room } from "@/hooks/useRooms";
import { useCondos } from "@/hooks/useCondos";
import { useAuth } from "@/hooks/useAuth";
import AddUnit from "@/pages/AddUnit";
import EditUnit from "@/pages/EditUnit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Plus, Copy, ChevronDown, ArrowLeft, Eye, Image } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { StandardModal } from "@/components/ui/standard-modal";
import { ActionButtons } from "@/components/ui/action-buttons";
import { StatCard } from "@/components/ui/stat-card";
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
      toast.error(e.message || "Failed to delete unit");
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">Units</h2>
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
            <option value="mix">Mixed Gender</option>
            <option value="female">Female Only</option>
            <option value="male">Male Only</option>
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
                  {formatUnitType(unit.unit_type)}
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
        {viewingUnit && <UnitViewContent unit={viewingUnit} condosData={condosData} isAdmin={isAdmin} />}
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

// ─── Unit View Content Component ───

interface AccessItem {
  id: string;
  access_type: string;
  locations?: string[];
  provided_by: string;
  chargeable_type: string;
  price: number;
  instruction: string;
}

function UnitViewContent({ unit, condosData, isAdmin }: { unit: Unit; condosData: any[]; isAdmin: boolean }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);
  const [viewAccordion, setViewAccordion] = useState<string[]>(["unit", "rooms", "carparks"]);
  const unitRooms = (unit.rooms || []).filter(r => r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark"));
  const unitCarparks = (unit.rooms || []).filter(r => r.room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark"));
  const occupiedPax = unitRooms.reduce((sum, r) => sum + (r.pax_staying || 0), 0);
  const remainingPax = unit.unit_max_pax - occupiedPax;
  const occupiedCarparks = unitCarparks.filter(r => r.status === "Occupied").length;
  const remainingCarparks = unitCarparks.length - occupiedCarparks;

  // Match condo by building name
  const condo = condosData.find(c => c.name === unit.building) || null;

  // Cost calculator state
  const [calcRoomId, setCalcRoomId] = useState("");
  const [calcPax, setCalcPax] = useState("1");
  const [calcCarparks, setCalcCarparks] = useState("0");

  const calcRoom = unitRooms.find(r => r.id === calcRoomId) || null;
  const pax = Number(calcPax) || 1;
  const numCarparks = Number(calcCarparks) || 0;
  const rental = calcRoom?.rent || 0;
  const depMul = (unit as any).deposit_multiplier ?? 1.5;
  const adminFee = (unit as any).admin_fee ?? 330;
  const deposit = Math.round(rental * depMul);

  // Access fees from condo
  const condoAccess = useMemo(() => {
    if (!condo) return { pedestrian: [] as AccessItem[], carpark: [] as AccessItem[] };
    const raw = condo.access_items || {};
    const parse = (key: string): AccessItem[] => {
      const items = (raw as any)[key];
      if (Array.isArray(items)) return items.filter((i: any) => i.access_type && i.access_type !== "None");
      return [];
    };
    return { pedestrian: [...parse("pedestrian"), ...parse("motorcycle")], carpark: parse("carpark") };
  }, [condo]);

  const accessFees = useMemo(() => {
    return condoAccess.pedestrian
      .filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0)
      .map(a => ({ label: `${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`, unitPrice: a.price, qty: pax, total: a.price * pax }));
  }, [condoAccess, pax]);

  const carparkFees = useMemo(() => {
    return condoAccess.carpark
      .filter(a => a.provided_by === "Homejoy" && a.chargeable_type !== "none" && a.price > 0)
      .map(a => ({ label: `Car Park ${a.access_type} (${a.chargeable_type === "deposit" ? "Deposit" : "Fee"})`, unitPrice: a.price, qty: numCarparks, total: a.price * numCarparks }));
  }, [condoAccess, numCarparks]);

  // Avg carpark rental
  const avgCarparkRent = unitCarparks.length > 0 ? Math.round(unitCarparks.reduce((s, c) => s + (c.rent || 0), 0) / unitCarparks.length) : 0;
  const carparkRentalTotal = avgCarparkRent * numCarparks;
  const totalAccessFees = accessFees.reduce((s, f) => s + f.total, 0);
  const totalCarparkFees = carparkFees.reduce((s, f) => s + f.total, 0);
  const grandTotal = rental + deposit + adminFee + totalAccessFees + totalCarparkFees + carparkRentalTotal;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const nc = "(not configured yet)";
  const val = (v: string | undefined | null) => v?.trim() || nc;

  const formatAccessItems = (label: string, items: AccessItem[]) => {
    if (!items || items.length === 0) return [`\n${label}: ${nc}`];
    return [
      `\n${label}:`,
      ...items.map(a => {
        const parts = [a.access_type];
        if (a.locations && a.locations.length > 0) parts.push(`@ ${a.locations.join(", ")}`);
        parts.push(`— ${a.provided_by || nc}`);
        if (a.chargeable_type && a.chargeable_type !== "none" && a.chargeable_type !== "Not Chargeable") {
          parts.push(`(${a.chargeable_type}${a.price > 0 ? ` RM${a.price}` : ""})`);
        }
        if (a.instruction) parts.push(`[${a.instruction}]`);
        return `  • ${parts.join(" ")}`;
      }),
    ];
  };

  const copyBuildingDetails = () => {
    const lines = [
      `Building: ${val(unit.building)}`,
      `Location: ${val(unit.location)}`,
      `Address: ${val(condo?.address)}`,
      `GPS: ${val(condo?.gps_link)}`,
      `Amenities: ${val(condo?.amenities)}`,
      `Parking: ${val(condo?.parking_info)}`,
      `Arrival: ${val(condo?.arrival_instruction)}`,
      ...formatAccessItems("Pedestrian Access", allAccess.pedestrian),
      ...formatAccessItems("Car Park Access", allAccess.carpark),
      ...formatAccessItems("Motorcycle Access", allAccess.motorcycle),
      `Visitor Car Parking: ${val(condo?.visitor_car_parking)}`,
      `Visitor Motorcycle Parking: ${val(condo?.visitor_motorcycle_parking)}`,
    ];
    copyToClipboard(lines.join("\n"), "Building details");
  };

  const copyHeader = (includeRoom?: { room: string; room_title?: string }) => {
    const lines = [`Building: ${val(unit.building)}`, `Unit: ${val(unit.unit)}`];
    if (includeRoom) lines.push(`Room: ${includeRoom.room} — ${includeRoom.room_title || ""}`);
    lines.push(`─────────`);
    return lines;
  };

  const copyUnitDetails = () => {
    const lines = [
      ...copyHeader(),
      `Type: ${val(formatUnitType(unit.unit_type))}`,
      `Max Occupants: ${unit.unit_max_pax}`,
      `Deposit: ${depMul} months`,
      `Admin Fee: RM${adminFee}`,
      `Meter: ${val((unit as any).meter_type)} · RM${(unit as any).meter_rate}/kWh`,
      `Passcode: ${val(unit.passcode)}`,
      `WiFi: ${val((unit as any).wifi_name)}`,
      `WiFi PW: ${val((unit as any).wifi_password)}`,
    ];
    copyToClipboard(lines.join("\n"), "Unit details");
  };

  const copyRoomSummary = () => {
    const rows = unitRooms.map(r => {
      const isOccupied = (r.status === "Occupied" || r.status === "Available Soon") && (r.pax_staying || 0) > 0;
      const roomLabel = r.room.replace(/^Room\s+/i, "");
      if (!isOccupied) {
        return `Room ${roomLabel} - Vacant`;
      }
      const housemates = Array.isArray(r.housemates) ? r.housemates : [];
      const names = housemates.map((h: any) => typeof h === "object" ? h?.name || "" : typeof h === "string" ? h : "").filter(Boolean);
      const genders = housemates.map((h: any) => typeof h === "object" ? h?.gender || "" : "").filter(Boolean).join(", ") || r.tenant_gender || "—";
      const nats = housemates.map((h: any) => typeof h === "object" ? h?.nationality || "" : "").filter(Boolean).join(", ") || "—";
      return `Room ${roomLabel}: ${r.pax_staying || 0} pax · ${genders} · ${nats}${names.length > 0 ? ` (${names.join(", ")})` : ""}`;
    });
    const header = copyHeader();
    copyToClipboard([...header, `Housemates:`, ...rows].join("\n"), "Room details");
  };

  const copyCostBreakdown = () => {
    if (!calcRoom) return;
    const lines = [
      ...copyHeader({ room: calcRoom.room, room_title: (calcRoom as any).room_title }),
      `Rental: RM${rental}`,
      `Deposit (${depMul}×): RM${deposit}`,
      `Admin Fee: RM${adminFee}`,
      ...accessFees.map(f => `${f.label}: RM${f.total}`),
      ...carparkFees.map(f => `${f.label}: RM${f.total}`),
      numCarparks > 0 ? `Carpark Rental (${numCarparks}×): RM${carparkRentalTotal}` : "",
      `─────────`,
      `Total Move-In: RM${grandTotal}`,
    ].filter(Boolean);
    copyToClipboard(lines.join("\n"), "Cost breakdown");
  };

  const TextCopyBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Copy className="h-3 w-3" /> {label}
    </button>
  );


  

  // Parse all access categories from condo (must be before early return)
  const allAccess = useMemo(() => {
    if (!condo) return { pedestrian: [] as AccessItem[], carpark: [] as AccessItem[], motorcycle: [] as AccessItem[] };
    const raw = condo.access_items || {};
    const parse = (key: string): AccessItem[] => {
      const items = (raw as any)[key];
      if (Array.isArray(items)) return items.filter((i: any) => i.access_type && i.access_type !== "None");
      return [];
    };
    return { pedestrian: parse("pedestrian"), carpark: parse("carpark"), motorcycle: parse("motorcycle") };
  }, [condo]);

  // Helper to render access items for a category
  const renderAccessCategory = (label: string, items: AccessItem[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</h4>
        {items.map((item, i) => (
          <div key={i} className="text-sm pl-2 border-l-2 border-muted py-1 space-y-0.5">
            <div className="font-medium">{item.access_type}{item.locations && item.locations.length > 0 ? ` — ${item.locations.join(", ")}` : ""}</div>
            <div className="text-xs text-muted-foreground">
              Provided by {item.provided_by}
              {item.chargeable_type && item.chargeable_type !== "none" && item.chargeable_type !== "Not Chargeable" && (
                <> · {item.chargeable_type}{item.price > 0 ? ` RM${item.price}` : ""}</>
              )}
            </div>
            {item.instruction && <div className="text-xs text-muted-foreground italic">{item.instruction}</div>}
          </div>
        ))}
      </div>
    );
  };

  const commonPhotosUrl = `${window.location.origin}/common/${unit.id}`;

  // If viewing a specific room/carpark, show detail view
  if (viewingRoom) {
    const isCarpark = viewingRoom.room_type === "Car Park" || (viewingRoom.room || "").toLowerCase().startsWith("carpark");
    const roomPhotoUrl = `${window.location.origin}/view/${unit.id}?room=${viewingRoom.id}&section=photos`;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setViewingRoom(null)}>
            <ArrowLeft className="h-4 w-4" /> Back to Unit
          </Button>
          {Array.isArray(viewingRoom.photos) && viewingRoom.photos.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => copyToClipboard(roomPhotoUrl, isCarpark ? "Carpark photos link" : "Room photos link")}>
                  <Image className="h-3.5 w-3.5" /> Copy {isCarpark ? "Carpark" : "Room"} Photos Link
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy link showing only this {isCarpark ? "carpark's" : "room's"} photos</TooltipContent>
            </Tooltip>
          )}
        </div>
        <h3 className="text-base font-semibold">{isCarpark ? `🅿️ ${viewingRoom.room}` : `Room ${viewingRoom.room.replace(/^Room\s+/i, "")}`}{(viewingRoom as any).room_title ? ` — ${(viewingRoom as any).room_title}` : ""}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border rounded-lg p-4">
          {!isCarpark && (
            <>
              <div><span className="text-muted-foreground">Room Title:</span> <span className="font-medium">{(viewingRoom as any).room_title || "—"}</span></div>
              <div><span className="text-muted-foreground">Room Category:</span> <span className="font-medium">{(viewingRoom as any).room_category || viewingRoom.room_type || "—"}</span></div>
              <div><span className="text-muted-foreground">Wall Type:</span> <span className="font-medium">{(viewingRoom as any).wall_type || "—"}</span></div>
              <div><span className="text-muted-foreground">Bed Type:</span> <span className="font-medium">{viewingRoom.bed_type || "—"}</span></div>
              <div><span className="text-muted-foreground">Max Pax:</span> <span className="font-medium">{viewingRoom.max_pax}</span></div>
              <div><span className="text-muted-foreground">Pax Staying:</span> <span className="font-medium">{viewingRoom.pax_staying || 0}</span></div>
            </>
          )}
          <div><span className="text-muted-foreground">Rental:</span> <span className="font-medium">RM{viewingRoom.rent}</span></div>
          <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewingRoom.status} availableDate={viewingRoom.available_date} /></div>
          <div><span className="text-muted-foreground">Available Date:</span> <span className="font-medium">{viewingRoom.available_date || "—"}</span></div>
          {!isCarpark && (
            <>
              <div><span className="text-muted-foreground">Gender:</span> <span className="font-medium">{viewingRoom.tenant_gender || "—"}</span></div>
              <div><span className="text-muted-foreground">Race:</span> <span className="font-medium">{viewingRoom.tenant_race || "—"}</span></div>
              {(viewingRoom as any).optional_features && Array.isArray((viewingRoom as any).optional_features) && (viewingRoom as any).optional_features.length > 0 && (
                <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Features:</span> <span className="font-medium">{(viewingRoom as any).optional_features.join(", ")}</span></div>
              )}
            </>
          )}
          {isCarpark && (
            <div><span className="text-muted-foreground">Parking Lot:</span> <span className="font-medium">{(viewingRoom as any).parking_lot || "—"}</span></div>
          )}
          {isAdmin && (
            <>
              <div><span className="text-muted-foreground">Assigned To:</span> <span className="font-medium">{(viewingRoom as any).assigned_to || "—"}</span></div>
              <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Internal Remark:</span> <span className="font-medium">{(viewingRoom as any).internal_remark || "—"}</span></div>
            </>
          )}
          <div><span className="text-muted-foreground">Internal Only:</span> <span className="font-medium">{viewingRoom.internal_only ? "🔒 Yes" : "No"}</span></div>
        </div>
        {!isCarpark && Array.isArray(viewingRoom.housemates) && viewingRoom.housemates.length > 0 && (
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold">Housemates</h4>
            <div className="space-y-1 text-sm">
              {viewingRoom.housemates.map((h: any, i: number) => (
                <div key={i} className="flex gap-4">
                  {typeof h === "object" ? (
                    <>
                      <span className="font-medium">{h.name || "—"}</span>
                      <span className="text-muted-foreground">{h.gender || ""}</span>
                      <span className="text-muted-foreground">{h.nationality || ""}</span>
                    </>
                  ) : <span>{String(h)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(viewingRoom.photos) && viewingRoom.photos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Photos</h4>
            <div className="flex flex-wrap gap-3">
              {(viewingRoom.photos as string[]).map((path: string, i: number) => (
                <img key={i} src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Room ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }


  const availableRooms = unitRooms.filter(r => r.status === "Available").length;

  return (
    <div className="space-y-4">
      {/* Expand/Collapse All — upper right */}
      <div className="fixed top-4 right-4 z-50">
        <Button variant="outline" size="sm" className="text-xs bg-card shadow-md" onClick={() => setViewAccordion(prev => prev.length === 3 ? [] : ["unit", "rooms", "carparks"])}>
          {viewAccordion.length === 3 ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {/* Stat Cards — non-collapsible */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Remaining Room"
          value={<>{availableRooms}/{unitRooms.length}</>}
          valueColor={availableRooms > 0 ? "text-emerald-600" : "text-muted-foreground"}
          className="text-center"
        />
        <StatCard
          label="Remaining Carpark"
          value={<>{remainingCarparks}/{unitCarparks.length}</>}
          valueColor={remainingCarparks > 0 ? "text-emerald-600" : "text-muted-foreground"}
          className="text-center"
        />
        <StatCard
          label="Remaining Pax"
          value={<>{remainingPax}/{unit.unit_max_pax}</>}
          valueColor={remainingPax > 0 ? "text-emerald-600" : remainingPax === 0 ? "text-muted-foreground" : "text-destructive"}
          className="text-center"
        />
      </div>

      <Accordion type="multiple" value={viewAccordion} onValueChange={setViewAccordion} className="space-y-2">
        {/* Unit — FIRST (photos + details) */}
        <AccordionItem value="unit" className="border rounded-lg px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-semibold">Unit</span>
              <span className="text-xs text-muted-foreground">— {unit.unit} · {formatUnitType(unit.unit_type)} · {unit.unit_max_pax} pax</span>
            </div>
            <div className="flex items-center gap-1 mr-2">
              <TextCopyBtn onClick={() => copyToClipboard(commonPhotosUrl, "Unit photos link")} label="Copy Unit Photos Link" />
              <TextCopyBtn onClick={copyUnitDetails} label="Copy Unit Details" />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {/* Unit photos first */}
            {((unit as any).common_photos || []).length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {((unit as any).common_photos as string[]).map((path: string, i: number) => (
                  <img key={i} src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Unit ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border" />
                ))}
              </div>
            )}
            {/* Unit details */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium">{unit.unit}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{formatUnitType(unit.unit_type)}</span></div>
              <div><span className="text-muted-foreground">Max Occupants:</span> <span className="font-medium">{unit.unit_max_pax}</span></div>
              <div><span className="text-muted-foreground">Deposit:</span> <span className="font-medium">{depMul} months</span></div>
              <div><span className="text-muted-foreground">Admin Fee:</span> <span className="font-medium">RM{adminFee}</span></div>
              <div><span className="text-muted-foreground">Meter:</span> <span className="font-medium">{(unit as any).meter_type} · RM{(unit as any).meter_rate}/kWh</span></div>
              <div><span className="text-muted-foreground">Passcode:</span> <span className="font-medium">{unit.passcode || "—"}</span></div>
              <div><span className="text-muted-foreground">WiFi:</span> <span className="font-medium">{(unit as any).wifi_name || "—"}</span></div>
              <div><span className="text-muted-foreground">WiFi PW:</span> <span className="font-medium">{(unit as any).wifi_password || "—"}</span></div>
              <div><span className="text-muted-foreground">Internal Only:</span> <span className="font-medium">{(unit as any).internal_only ? "🔒 Yes" : "No"}</span></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Room — SECOND */}
        {unitRooms.length > 0 && (
          <AccordionItem value="rooms" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-semibold">Room</span>
                <span className="text-xs text-muted-foreground">— {unitRooms.length} rooms</span>
              </div>
              <div className="flex items-center gap-1 mr-2">
                <TextCopyBtn onClick={copyRoomSummary} label="Copy Room Details" />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Room Title</TableHead>
                      <TableHead className="text-right">Rental</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Pax</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Nationality</TableHead>
                      {isAdmin && <TableHead>Tenant</TableHead>}
                      <TableHead className="text-center w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitRooms.map(room => {
                      const housemates = Array.isArray(room.housemates) ? room.housemates : [];
                      const genders = housemates.map((h: any) => typeof h === "object" ? h?.gender || "" : "").filter(Boolean).join(", ") || room.tenant_gender || "—";
                      const nats = housemates.map((h: any) => typeof h === "object" ? h?.nationality || "" : "").filter(Boolean).join(", ") || "—";
                      const tenantNames = housemates.map((h: any) => typeof h === "object" ? h?.name || "" : typeof h === "string" ? h : "").filter(Boolean).join(", ") || "—";
                      return (
                        <TableRow key={room.id}>
                          <TableCell className="font-medium">{room.room.replace(/^Room\s+/i, "")}</TableCell>
                          <TableCell>{(room as any).room_title || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell className="text-right">RM{room.rent}</TableCell>
                          <TableCell><StatusBadge status={room.status} availableDate={room.available_date} /></TableCell>
                          <TableCell className="text-center">{room.pax_staying || 0}</TableCell>
                          <TableCell>{genders}</TableCell>
                          <TableCell>{nats}</TableCell>
                          {isAdmin && <TableCell className="text-xs">{tenantNames}</TableCell>}
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewingRoom(room)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Carpark — THIRD */}
        {unitCarparks.length > 0 && (
          <AccordionItem value="carparks" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-semibold">Carpark</span>
                <span className="text-xs text-muted-foreground">— {unitCarparks.length} carparks</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead className="text-right">Rental</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Tenant</TableHead>}
                      <TableHead className="text-center w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitCarparks.map(cp => (
                      <TableRow key={cp.id}>
                        <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                        <TableCell>{(cp as any).parking_lot || "—"}</TableCell>
                        <TableCell className="text-right">RM{cp.rent}</TableCell>
                        <TableCell><StatusBadge status={cp.status} /></TableCell>
                        {isAdmin && <TableCell className="text-xs">{(cp as any).assigned_to || "—"}</TableCell>}
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewingRoom(cp)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Cost Breakdown Calculator */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Move-In Cost Calculator</h3>
          {calcRoom && <TextCopyBtn onClick={copyCostBreakdown} label="Copy Cost Breakdown" />}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 min-w-0">
            <label className={labelClass}>Room</label>
            <select className={`${inputClass} w-full`} value={calcRoomId} onChange={e => setCalcRoomId(e.target.value)}>
              <option value="">Select room</option>
              {unitRooms.map(r => (
                <option key={r.id} value={r.id}>{r.room.replace(/^Room\s+/i, "")} — RM{r.rent}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 min-w-0">
            <label className={labelClass}>Pax</label>
            <input type="number" min="1" className={`${inputClass} w-full`} value={calcPax} onChange={e => setCalcPax(e.target.value)} />
          </div>
          <div className="space-y-1 min-w-0">
            <label className={labelClass}>Carparks</label>
            <input type="number" min="0" className={`${inputClass} w-full`} value={calcCarparks} onChange={e => setCalcCarparks(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">1 Month Advance Rental</TableCell>
                <TableCell className="text-right font-medium">RM{rental}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Deposit ({depMul}× rental)</TableCell>
                <TableCell className="text-right font-medium">RM{deposit}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Admin Fee</TableCell>
                <TableCell className="text-right font-medium">RM{adminFee}</TableCell>
              </TableRow>
              {accessFees.map((f, i) => (
                <TableRow key={`af-${i}`}>
                  <TableCell className="text-muted-foreground">{f.label} (×{f.qty})</TableCell>
                  <TableCell className="text-right font-medium">RM{f.total}</TableCell>
                </TableRow>
              ))}
              {numCarparks > 0 && carparkFees.map((f, i) => (
                <TableRow key={`cf-${i}`}>
                  <TableCell className="text-muted-foreground">{f.label} (×{f.qty})</TableCell>
                  <TableCell className="text-right font-medium">RM{f.total}</TableCell>
                </TableRow>
              ))}
              {numCarparks > 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground">Carpark Rental ({numCarparks}× RM{avgCarparkRent})</TableCell>
                  <TableCell className="text-right font-medium">RM{carparkRentalTotal}</TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/30">
                <TableCell className="font-semibold">Total Move-In Cost</TableCell>
                <TableCell className="text-right font-bold text-lg">RM{grandTotal}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

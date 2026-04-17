import { useState, useMemo, useEffect, useCallback } from "react";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { toast } from "sonner";
import { useCondos, useDeleteCondo, Condo } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { useUnits } from "@/hooks/useRooms";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StandardModal } from "@/components/ui/standard-modal";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { AccessItem } from "@/components/BuildingForm";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { AdvancedFiltersToggle, AdvancedFiltersPanel } from "@/components/AdvancedFiltersToggle";
import { StandardTable } from "@/components/ui/standard-table";
import { ActionButtons } from "@/components/ui/action-buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass, labelClass, filterFieldClass } from "@/lib/ui-constants";
import { StatCard } from "@/components/ui/stat-card";

const CHARGEABLE_LABELS: Record<string, string> = {
  none: "Not Chargeable",
  deposit: "Deposit",
  one_time_fee: "One-time Fee",
  processing_fee: "Processing Fee",
};

interface CondosContentProps {
  onOpenForm: (building?: Condo) => void;
}

export function CondosContent({ onOpenForm }: CondosContentProps) {
  const { data: condos = [], isLoading } = useCondos();
  const { data: locations = [] } = useLocations();
  const { data: units = [] } = useUnits();
  const deleteCondo = useDeleteCondo();

  const [viewing, setViewing] = useState<Condo | null>(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [hasAvailableUnits, setHasAvailableUnits] = useState("");
  const [hasAvailableRooms, setHasAvailableRooms] = useState("");
  const [hasAvailableCarparks, setHasAvailableCarparks] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [viewSections, setViewSections] = useState<Record<string, boolean>>({ details: true, photos: true, pedestrian: true, carpark: true, motorcycle: true, visitor: true });
  const toggleViewSection = (key: string) => setViewSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation for photo lightbox
  const lightboxPhotos = viewing?.photos as string[] | undefined;
  const lightboxPhotoCount = lightboxPhotos?.length ?? 0;

  useEffect(() => {
    if (photoLightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhotoLightboxIndex(null);
      if (e.key === "ArrowLeft" && photoLightboxIndex > 0) setPhotoLightboxIndex(photoLightboxIndex - 1);
      if (e.key === "ArrowRight" && photoLightboxIndex < lightboxPhotoCount - 1) setPhotoLightboxIndex(photoLightboxIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photoLightboxIndex, lightboxPhotoCount]);

  const condoStats = useMemo(() => {
    const map: Record<string, { totalUnits: number; totalRooms: number; totalCarparks: number; availableUnits: number; availableRooms: number; availableCarparks: number }> = {};
    for (const c of condos) {
      const condoUnits = units.filter(u => u.building === c.name);
      const allRooms = condoUnits.flatMap(u => u.rooms || []);
      const rooms = allRooms.filter(r => r.room_type !== "Car Park");
      const carparks = allRooms.filter(r => r.room_type === "Car Park");
      const availableUnits = condoUnits.filter(u => (u.rooms || []).some(r => r.room_type !== "Car Park" && (r.status === "Available" || r.status === "Available Soon"))).length;
      map[c.id] = {
        totalUnits: condoUnits.length,
        totalRooms: rooms.length,
        totalCarparks: carparks.length,
        availableUnits,
        availableRooms: rooms.filter(r => r.status === "Available" || r.status === "Available Soon").length,
        availableCarparks: carparks.filter(r => r.status === "Available" || r.status === "Available Soon").length,
      };
    }
    return map;
  }, [condos, units]);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteCondo.mutateAsync(deleteId); } catch (e: any) { toast.error(e.message || "Failed to delete building"); }
    setDeleteId(null);
  };

  const { sort, handleSort, sortData } = useTableSort("name");

  const hasActiveFilters = !!locationFilter || !!nameFilter || !!hasAvailableUnits || !!hasAvailableRooms || !!hasAvailableCarparks;

  const clearFilters = () => {
    setLocationFilter("");
    setNameFilter("");
    setHasAvailableUnits("");
    setHasAvailableRooms("");
    setHasAvailableCarparks("");
  };

  const filtered = condos.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.location?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.address || "").toLowerCase().includes(search.toLowerCase());
    const matchName = !nameFilter || c.name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchLocation = !locationFilter || c.location_id === locationFilter;
    const s = condoStats[c.id];
    const matchAvailUnits = !hasAvailableUnits || (hasAvailableUnits === "yes" ? (s?.availableUnits || 0) > 0 : (s?.availableUnits || 0) === 0);
    const matchAvailRooms = !hasAvailableRooms || (hasAvailableRooms === "yes" ? (s?.availableRooms || 0) > 0 : (s?.availableRooms || 0) === 0);
    const matchAvailCarparks = !hasAvailableCarparks || (hasAvailableCarparks === "yes" ? (s?.availableCarparks || 0) > 0 : (s?.availableCarparks || 0) === 0);
    return matchSearch && matchName && matchLocation && matchAvailUnits && matchAvailRooms && matchAvailCarparks;
  });

  const sortedFiltered = sortData(filtered, (c, key: string) => {
    const s = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableUnits: 0, availableRooms: 0, availableCarparks: 0 };
    const map: Record<string, any> = {
      name: c.name,
      location: c.location?.name || "",
      address: c.address || "",
      availableUnits: s.availableUnits,
      availableRooms: s.availableRooms,
      availableCarparks: s.availableCarparks,
    };
    return map[key];
  });

  const viewStats = viewing ? (condoStats[viewing.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableUnits: 0, availableRooms: 0, availableCarparks: 0 }) : null;

  const summaryTotals = useMemo(() => {
    return sortedFiltered.reduce((acc, c) => {
      const s = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableUnits: 0, availableRooms: 0, availableCarparks: 0 };
      acc.totalBuildings += 1;
      acc.totalUnits += s.totalUnits;
      acc.availableUnits += s.availableUnits;
      acc.totalRooms += s.totalRooms;
      acc.availableRooms += s.availableRooms;
      acc.totalCarparks += s.totalCarparks;
      acc.availableCarparks += s.availableCarparks;
      return acc;
    }, { totalBuildings: 0, totalUnits: 0, availableUnits: 0, totalRooms: 0, availableRooms: 0, totalCarparks: 0, availableCarparks: 0 });
  }, [sortedFiltered, condoStats]);

  /* ── Render access items for View dialog ── */
  const renderViewAccessItems = (items: AccessItem[], showLocations: boolean) => {
    if (!items || items.length === 0) return <span className="text-muted-foreground text-sm">None configured</span>;
    return (
      <div className="space-y-2">
        {items.map((item, i) => {
          const isNone = item.access_type === "None";
          return (
            <div key={item.id || i} className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.access_type}</span>
                {showLocations && item.locations?.length > 0 && (
                  <span className="text-muted-foreground">@ {item.locations.join(", ")}</span>
                )}
              </div>
              {!isNone && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Provided by: <span className="text-foreground">{item.provided_by}</span></span>
                  <span>Chargeable: <span className="text-foreground">{CHARGEABLE_LABELS[item.chargeable_type] || "Not Chargeable"}</span></span>
                  {item.chargeable_type !== "none" && item.price > 0 && (
                    <span>Price: <span className="text-foreground">RM{item.price}</span></span>
                  )}
                </div>
              )}
              {!isNone && item.instruction && (
                <p className="text-xs text-muted-foreground">📝 {item.instruction}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const getAccessItems = (condo: Condo, key: string): AccessItem[] => {
    const access = (condo as any)?.access_items;
    if (!access) return [];
    const raw = access[key];
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && raw.access_type) return [raw];
    return [];
  };

  const notConfigured = "(not configured yet)";

  const formatAccessText = (items: AccessItem[], title: string, showLocations: boolean) => {
    const header = `*${title}*`;
    if (!items || items.length === 0) return `${header}\n${notConfigured}`;
    const blocks = items.map((item, i) => {
      const isNone = item.access_type === "None";
      const parts: string[] = [];
      let heading = `${i + 1}. *${item.access_type}*`;
      if (showLocations && item.locations?.length) heading += ` — ${item.locations.join(", ")}`;
      parts.push(heading);
      if (!isNone) {
        if (item.provided_by) parts.push(`   • Provided by: ${item.provided_by}`);
        const chargeLabel = CHARGEABLE_LABELS[item.chargeable_type] || "Not Chargeable";
        let charge = `   • Charge: ${chargeLabel}`;
        if (item.chargeable_type !== "none" && item.price > 0) charge += ` (RM${item.price})`;
        parts.push(charge);
        if (item.instruction) parts.push(`   • Note: ${item.instruction}`);
      }
      return parts.join("\n");
    });
    return `${header}\n${blocks.join("\n\n")}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success(`${label} copied`);
    } catch (e) {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const val = (v: string | undefined | null) => v?.trim() || notConfigured;
  const optional = (v: string | undefined | null) => v?.trim() || "";

  const copyBuildingDetails = (condo: Condo) => {
    const lines: string[] = [`*${val(condo.name)}*`];
    const loc = optional(condo.location?.name);
    if (loc) lines.push(`📍 ${loc}`);
    const addr = optional(condo.address);
    if (addr) lines.push(`🏠 ${addr}`);
    const gps = optional(condo.gps_link);
    if (gps) lines.push(`📌 ${gps}`);
    const desc = optional(condo.description);
    if (desc) lines.push(`\n*About*\n${desc}`);
    const am = optional(condo.amenities);
    if (am) lines.push(`\n*Amenities*\n${am}`);
    copyToClipboard(lines.join("\n"), "Building details");
  };

  const copyVisitorInfo = (condo: Condo) => {
    const lines: string[] = [`*Visitor / Parking Info — ${val(condo.name)}*`];
    const car = optional((condo as any).visitor_car_parking);
    if (car) lines.push(`🚗 *Car Parking*\n${car}`);
    const moto = optional((condo as any).visitor_motorcycle_parking);
    if (moto) lines.push(`🏍️ *Motorcycle Parking*\n${moto}`);
    const arr = optional((condo as any).arrival_instruction);
    if (arr) lines.push(`🧭 *Arrival Instruction*\n${arr}`);
    if (lines.length === 1) lines.push(notConfigured);
    copyToClipboard(lines.join("\n\n"), "Visitor/Parking info");
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <StandardPageLayout title="Buildings" actionLabel="Add Building" actionIcon={<Plus className="h-4 w-4" />} onAction={() => onOpenForm()}>
      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Building?"
        description="This building and its data will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Summary (collapsed by default) */}
      <div className="bg-card rounded-xl shadow-sm border border-border">
        <button
          type="button"
          onClick={() => setShowSummary(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            {showSummary ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <h3 className="text-base font-semibold text-foreground">Summary</h3>
            <span className="text-xs text-muted-foreground">
              ({summaryTotals.totalBuildings} buildings · {summaryTotals.availableUnits}/{summaryTotals.totalUnits} units available)
            </span>
          </div>
        </button>
        {showSummary && (
          <div className="border-t border-border p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Buildings" value={summaryTotals.totalBuildings} />
            <StatCard
              label="Available Units"
              value={<><span className="text-emerald-600">{summaryTotals.availableUnits}</span><span className="text-muted-foreground text-lg font-semibold">/{summaryTotals.totalUnits}</span></>}
            />
            <StatCard
              label="Available Rooms"
              value={<><span className="text-emerald-600">{summaryTotals.availableRooms}</span><span className="text-muted-foreground text-lg font-semibold">/{summaryTotals.totalRooms}</span></>}
            />
            <StatCard
              label="Available Carparks"
              value={<><span className="text-emerald-600">{summaryTotals.availableCarparks}</span><span className="text-muted-foreground text-lg font-semibold">/{summaryTotals.totalCarparks}</span></>}
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <StandardFilterBar search={search} onSearchChange={setSearch} placeholder="Search buildings..." hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters}>
        <div className="space-y-1.5 min-w-[160px]">
          <label className={labelClass}>Location</label>
          <select className={filterFieldClass(!!locationFilter)} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="">All</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <AdvancedFiltersToggle
          open={showAdvanced}
          onToggle={() => setShowAdvanced(v => !v)}
          activeCount={
            (nameFilter ? 1 : 0) +
            (hasAvailableUnits ? 1 : 0) +
            (hasAvailableRooms ? 1 : 0) +
            (hasAvailableCarparks ? 1 : 0)
          }
          className="self-end"
        />
        <AdvancedFiltersPanel open={showAdvanced}>
          <div className="space-y-1.5 min-w-[200px] flex-1 max-w-xs">
            <label className={labelClass}>Building Name</label>
            <input
              type="text"
              placeholder="Type to filter..."
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              className={filterFieldClass(!!nameFilter)}
            />
          </div>
          <div className="space-y-1.5 min-w-[140px]">
            <label className={labelClass}>Available Units</label>
            <select className={filterFieldClass(!!hasAvailableUnits)} value={hasAvailableUnits} onChange={e => setHasAvailableUnits(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="space-y-1.5 min-w-[140px]">
            <label className={labelClass}>Available Rooms</label>
            <select className={filterFieldClass(!!hasAvailableRooms)} value={hasAvailableRooms} onChange={e => setHasAvailableRooms(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="space-y-1.5 min-w-[140px]">
            <label className={labelClass}>Available Carparks</label>
            <select className={filterFieldClass(!!hasAvailableCarparks)} value={hasAvailableCarparks} onChange={e => setHasAvailableCarparks(e.target.value)}>
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </AdvancedFiltersPanel>
      </StandardFilterBar>

      {/* Table */}
      <StandardTable
        columns={
          <TableRow>
            <TableHead className="w-12">No.</TableHead>
            <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Building Name</SortableTableHead>
            <SortableTableHead sortKey="availableUnits" currentSort={sort} onSort={handleSort} className="text-center">Available Units</SortableTableHead>
            <SortableTableHead sortKey="availableRooms" currentSort={sort} onSort={handleSort} className="text-center">Available Rooms</SortableTableHead>
            <SortableTableHead sortKey="availableCarparks" currentSort={sort} onSort={handleSort} className="text-center">Available Carparks</SortableTableHead>
            <TableHead className="w-36 text-right">Actions</TableHead>
          </TableRow>
        }
        isEmpty={sortedFiltered.length === 0}
        emptyMessage="No buildings found"
        total={sortedFiltered.length}
      >
        {sortedFiltered.map((c, i) => {
          const s = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableUnits: 0, availableRooms: 0, availableCarparks: 0 };
          return (
            <TableRow key={c.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-center font-semibold">
                <span className={s.availableUnits > 0 ? "text-emerald-600" : "text-muted-foreground"}>{s.availableUnits}</span>
                <span className="text-muted-foreground font-normal">/{s.totalUnits}</span>
              </TableCell>
              <TableCell className="text-center font-semibold">
                <span className={s.availableRooms > 0 ? "text-emerald-600" : "text-muted-foreground"}>{s.availableRooms}</span>
                <span className="text-muted-foreground font-normal">/{s.totalRooms}</span>
              </TableCell>
              <TableCell className="text-center font-semibold">
                <span className={s.availableCarparks > 0 ? "text-emerald-600" : "text-muted-foreground"}>{s.availableCarparks}</span>
                <span className="text-muted-foreground font-normal">/{s.totalCarparks}</span>
              </TableCell>
              <TableCell className="text-right">
                <ActionButtons actions={[
                  { type: "view", onClick: () => setViewing(c) },
                  { type: "edit", onClick: () => onOpenForm(c) },
                  { type: "delete", onClick: () => setDeleteId(c.id) },
                ]} />
              </TableCell>
            </TableRow>
          );
        })}
      </StandardTable>

      {/* View Dialog */}
      <StandardModal
        open={!!viewing}
        onOpenChange={(open) => { if (!open) { setViewing(null); setViewSections({ details: true, photos: true, pedestrian: true, carpark: true, motorcycle: true, visitor: true }); } }}
        title="Building Details"
        size="lg"
        hideCancel
        footer={<Button variant="outline" onClick={() => { setViewing(null); setViewSections({ details: true, photos: true, pedestrian: true, carpark: true, motorcycle: true, visitor: true }); }}>Close</Button>}
      >
        {viewing && (() => {
          const allViewExpanded = Object.values(viewSections).every(Boolean);
          const toggleAllView = () => {
            const newVal = !allViewExpanded;
            setViewSections({ details: newVal, photos: newVal, pedestrian: newVal, carpark: newVal, motorcycle: newVal, visitor: newVal });
          };
          return (
          <div className="space-y-5">
               <div className="fixed top-4 right-4 z-50">
                <Button variant="outline" size="sm" onClick={toggleAllView} className="text-xs bg-card shadow-md">
                  {allViewExpanded ? "Collapse All" : "Expand All"}
                </Button>
              </div>
              {/* Lightbox with prev/next */}
              {photoLightboxIndex !== null && viewing.photos && viewing.photos.length > 0 && (() => {
                const photos = viewing.photos;
                const photoUrls = photos.map((p: string) => `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${p}`);
                return <PhotoLightbox photos={photoUrls} index={photoLightboxIndex} onClose={() => setPhotoLightboxIndex(null)} onIndexChange={setPhotoLightboxIndex} />;
              })()}

              {/* 1. Stat Cards */}
              {viewStats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Available Units", available: viewStats.availableUnits, total: viewStats.totalUnits },
                    { label: "Available Rooms", available: viewStats.availableRooms, total: viewStats.totalRooms },
                    { label: "Available Carparks", available: viewStats.availableCarparks, total: viewStats.totalCarparks },
                  ].map(item => (
                    <StatCard
                      key={item.label}
                      label={item.label}
                      value={<><span className={item.available > 0 ? "text-emerald-600" : ""}>{item.available}</span><span className="text-muted-foreground font-normal text-sm">/{item.total}</span></>}
                      className="text-center"
                    />
                  ))}
                </div>
              )}

              {/* 2. Building Photos */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("photos")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Building Photos</h3>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/building-photos/${viewing.id}`;
                        copyToClipboard(url, "Building photo link");
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                      title="Copy building photo link"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Building Photo Link
                    </span>
                    {viewSections.photos ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.photos && (
                  <div className="px-4 pb-4">
                    {viewing.photos && viewing.photos.length > 0 ? (
                      <div className="grid grid-cols-4 gap-3">
                        {viewing.photos.map((path, i) => (
                          <img
                            key={path}
                            src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`}
                            alt={`Photo ${i + 1}`}
                            className="h-28 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPhotoLightboxIndex(i)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No photos uploaded</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Building Details - Collapsible */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("details")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Building Details</h3>
                  <div className="flex items-center gap-2">
                    <span onClick={e => { e.stopPropagation(); copyBuildingDetails(viewing); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer" title="Copy building details">
                      <Copy className="h-3.5 w-3.5" /> Copy Building Details
                    </span>
                    {viewSections.details ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.details && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div><span className="text-muted-foreground">Building Name:</span> <span className="font-medium">{viewing.name}</span></div>
                      <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{viewing.location?.name || "N/A"}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{viewing.address || "N/A"}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">GPS Link:</span> {viewing.gps_link ? <a href={viewing.gps_link} target="_blank" rel="noreferrer" className="text-primary underline">{viewing.gps_link}</a> : <span className="font-medium">—</span>}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-medium">{viewing.description || "N/A"}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Amenities:</span> <span className="font-medium">{viewing.amenities || "N/A"}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Visitor / Parking Info */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("visitor")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Visitor / Parking Info</h3>
                  <div className="flex items-center gap-2">
                    <span onClick={e => { e.stopPropagation(); copyVisitorInfo(viewing); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer" title="Copy visitor/parking info">
                      <Copy className="h-3.5 w-3.5" /> Copy Visitor/Parking Info
                    </span>
                    {viewSections.visitor ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.visitor && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div><span className="text-muted-foreground">Visitor Car Parking:</span> <span className="font-medium">{(viewing as any).visitor_car_parking || "N/A"}</span></div>
                      <div><span className="text-muted-foreground">Visitor Motorcycle Parking:</span> <span className="font-medium">{(viewing as any).visitor_motorcycle_parking || "N/A"}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Arrival Instruction:</span> <span className="font-medium whitespace-pre-wrap">{(viewing as any).arrival_instruction || "N/A"}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Pedestrian Access */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("pedestrian")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Pedestrian Access</h3>
                  <div className="flex items-center gap-2">
                    <span onClick={e => { e.stopPropagation(); copyToClipboard(formatAccessText(getAccessItems(viewing, "pedestrian"), "Pedestrian Access", true), "Pedestrian access"); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer" title="Copy pedestrian access">
                      <Copy className="h-3.5 w-3.5" /> Copy Pedestrian Access
                    </span>
                    {viewSections.pedestrian ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.pedestrian && (
                  <div className="px-4 pb-4">{renderViewAccessItems(getAccessItems(viewing, "pedestrian"), true)}</div>
                )}
              </div>

              {/* 6. Car Park Access */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("carpark")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Car Park Access</h3>
                  <div className="flex items-center gap-2">
                    <span onClick={e => { e.stopPropagation(); copyToClipboard(formatAccessText(getAccessItems(viewing, "carpark"), "Car Park Access", false), "Car park access"); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer" title="Copy car park access">
                      <Copy className="h-3.5 w-3.5" /> Copy Car Park Access
                    </span>
                    {viewSections.carpark ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.carpark && (
                  <div className="px-4 pb-4">{renderViewAccessItems(getAccessItems(viewing, "carpark"), false)}</div>
                )}
              </div>

              {/* 7. Motorcycle Access */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <button type="button" onClick={() => toggleViewSection("motorcycle")} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-base font-semibold text-foreground">Motorcycle Access</h3>
                  <div className="flex items-center gap-2">
                    <span onClick={e => { e.stopPropagation(); copyToClipboard(formatAccessText(getAccessItems(viewing, "motorcycle"), "Motorcycle Access", false), "Motorcycle access"); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors cursor-pointer" title="Copy motorcycle access">
                      <Copy className="h-3.5 w-3.5" /> Copy Motorcycle Access
                    </span>
                    {viewSections.motorcycle ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {viewSections.motorcycle && (
                  <div className="px-4 pb-4">{renderViewAccessItems(getAccessItems(viewing, "motorcycle"), false)}</div>
                )}
              </div>
          </div>
          );
        })()}
      </StandardModal>
    </StandardPageLayout>
  );
}
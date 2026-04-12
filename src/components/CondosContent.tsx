import { useState, useMemo } from "react";
import { useCondos, useDeleteCondo, Condo } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { useUnits } from "@/hooks/useRooms";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, Eye } from "lucide-react";
import { AccessItem } from "@/components/BuildingForm";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";

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

  const condoStats = useMemo(() => {
    const map: Record<string, { totalUnits: number; totalRooms: number; totalCarparks: number; availableRooms: number; availableCarparks: number }> = {};
    for (const c of condos) {
      const condoUnits = units.filter(u => u.building === c.name);
      const allRooms = condoUnits.flatMap(u => u.rooms || []);
      const rooms = allRooms.filter(r => r.room_type !== "Car Park");
      const carparks = allRooms.filter(r => r.room_type === "Car Park");
      map[c.id] = {
        totalUnits: condoUnits.length,
        totalRooms: rooms.length,
        totalCarparks: carparks.length,
        availableRooms: rooms.filter(r => r.status === "Available").length,
        availableCarparks: carparks.filter(r => r.status === "Available").length,
      };
    }
    return map;
  }, [condos, units]);

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building?")) return;
    try { await deleteCondo.mutateAsync(id); } catch (e: any) { alert(e.message); }
  };

  const { sort, handleSort, sortData } = useTableSort("name");

  const filtered = condos.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.location?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.address || "").toLowerCase().includes(search.toLowerCase());
    const matchLocation = !locationFilter || c.location_id === locationFilter;
    return matchSearch && matchLocation;
  });

  const sortedFiltered = sortData(filtered, (c, key: string) => {
    const s = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableRooms: 0, availableCarparks: 0 };
    const map: Record<string, any> = {
      name: c.name,
      location: c.location?.name || "",
      address: c.address || "",
      totalUnits: s.totalUnits,
      totalRooms: s.totalRooms,
      totalCarparks: s.totalCarparks,
      availableRooms: s.availableRooms,
      availableCarparks: s.availableCarparks,
    };
    return map[key];
  });

  const viewStats = viewing ? (condoStats[viewing.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableRooms: 0, availableCarparks: 0 }) : null;

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

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Buildings</div>
        <Button onClick={() => onOpenForm()}>
          <Plus className="h-4 w-4" /> Add Building
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input className={`${inputClass} w-full max-w-sm`} placeholder="Search buildings..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className={`${inputClass}`} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No.</TableHead>
              <SortableTableHead sortKey="location" currentSort={sort} onSort={handleSort}>Location</SortableTableHead>
              <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Building Name</SortableTableHead>
              
              <SortableTableHead sortKey="totalUnits" currentSort={sort} onSort={handleSort} className="text-center">Total Units</SortableTableHead>
              <SortableTableHead sortKey="totalRooms" currentSort={sort} onSort={handleSort} className="text-center">Total Rooms</SortableTableHead>
              <SortableTableHead sortKey="totalCarparks" currentSort={sort} onSort={handleSort} className="text-center">Total Carparks</SortableTableHead>
              <SortableTableHead sortKey="availableRooms" currentSort={sort} onSort={handleSort} className="text-center">Available Rooms</SortableTableHead>
              <SortableTableHead sortKey="availableCarparks" currentSort={sort} onSort={handleSort} className="text-center">Available Carparks</SortableTableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFiltered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No buildings found</TableCell></TableRow>
            ) : sortedFiltered.map((c, i) => {
              const s = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableRooms: 0, availableCarparks: 0 };
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-muted-foreground">{c.location?.name || "—"}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="truncate block text-muted-foreground text-sm">{c.address || "—"}</span>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{s.totalUnits}</TableCell>
                  <TableCell className="text-center font-semibold">{s.totalRooms}</TableCell>
                  <TableCell className="text-center font-semibold">{s.totalCarparks}</TableCell>
                  <TableCell className="text-center font-semibold">{s.availableRooms}</TableCell>
                  <TableCell className="text-center font-semibold">{s.availableCarparks}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setViewing(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="View"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => onOpenForm(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Building Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-4">
              {viewing.photos && viewing.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {viewing.photos.map((path, i) => (
                    <img key={path} src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Photo ${i + 1}`} className="h-28 w-full object-cover rounded-lg" />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-muted-foreground">Building Name:</span> <span className="font-medium">{viewing.name}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{viewing.location?.name || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{viewing.address || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">GPS Link:</span> {viewing.gps_link ? <a href={viewing.gps_link} target="_blank" rel="noreferrer" className="text-primary underline">{viewing.gps_link}</a> : <span className="font-medium">—</span>}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-medium">{viewing.description || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Amenities:</span> <span className="font-medium">{viewing.amenities || "—"}</span></div>
              </div>
              {viewStats && (
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Units", value: viewStats.totalUnits },
                    { label: "Rooms", value: viewStats.totalRooms },
                    { label: "Carparks", value: viewStats.totalCarparks },
                    { label: "Avail Rooms", value: viewStats.availableRooms },
                    { label: "Avail Carparks", value: viewStats.availableCarparks },
                  ].map(item => (
                    <div key={item.label} className="bg-secondary rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Access Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Pedestrian Access</h3>
                {renderViewAccessItems(getAccessItems(viewing, "pedestrian"), true)}

                <h3 className="text-sm font-bold text-foreground border-b pb-2">Car Park Access</h3>
                {renderViewAccessItems(getAccessItems(viewing, "carpark"), false)}

                <h3 className="text-sm font-bold text-foreground border-b pb-2">Motorcycle Access</h3>
                {renderViewAccessItems(getAccessItems(viewing, "motorcycle"), false)}
              </div>

              {/* Visitor / Parking Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Visitor / Parking Info</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-muted-foreground">Visitor Car Parking:</span> <span className="font-medium">{(viewing as any).visitor_car_parking || "—"}</span></div>
                  <div><span className="text-muted-foreground">Visitor Motorcycle Parking:</span> <span className="font-medium">{(viewing as any).visitor_motorcycle_parking || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Arrival Instruction:</span> <span className="font-medium whitespace-pre-wrap">{(viewing as any).arrival_instruction || "—"}</span></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
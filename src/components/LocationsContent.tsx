import { useState, useMemo } from "react";
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from "@/hooks/useLocations";
import { useCondos } from "@/hooks/useCondos";
import { useUnits } from "@/hooks/useRooms";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";

export function LocationsContent() {
  const { data: locations = [], isLoading } = useLocations();
  const { data: condos = [] } = useCondos();
  const { data: units = [] } = useUnits();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  // Build stats per location
  const locationStats = useMemo(() => {
    const map: Record<string, {
      buildings: number; units: number; rooms: number;
      available: number; availableSoon: number; pending: number; occupied: number;
    }> = {};
    for (const loc of locations) {
      const locCondos = condos.filter(c => c.location_id === loc.id);
      const buildingNames = new Set(locCondos.map(c => c.name));
      const locUnits = units.filter(u => buildingNames.has(u.building));
      const rooms = locUnits.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park"));
      map[loc.id] = {
        buildings: locCondos.length,
        units: locUnits.length,
        rooms: rooms.length,
        available: rooms.filter(r => r.status === "Available").length,
        availableSoon: rooms.filter(r => r.status === "Available Soon").length,
        pending: rooms.filter(r => r.status === "Reserved").length,
        occupied: rooms.filter(r => r.status === "Tenanted" || r.status === "Occupied").length,
      };
    }
    return map;
  }, [locations, condos, units]);

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const openCreate = () => { setEditingId(null); setName(""); setShowForm(true); };
  const openEdit = (loc: { id: string; name: string }) => { setEditingId(loc.id); setName(loc.name); setShowForm(true); };

  const handleSave = async () => {
    if (!name.trim()) { alert("Location name is required"); return; }
    try {
      if (editingId) {
        await updateLocation.mutateAsync({ id: editingId, name: name.trim() });
      } else {
        await createLocation.mutateAsync(name.trim());
      }
      setShowForm(false); setName(""); setEditingId(null);
    } catch (e: any) { alert(e.message || "Failed to save location"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this location? Buildings linked to it will have their location cleared.")) return;
    try { await deleteLocation.mutateAsync(id); } catch (e: any) { alert(e.message || "Failed to delete location"); }
  };

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Locations</div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Add Location
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg shadow-sm p-6 space-y-4 border">
          <div className="text-lg font-semibold">{editingId ? "Edit Location" : "Add Location"}</div>
          <input className={`${inputClass} w-full`} placeholder="Location name (e.g. Bukit Jalil)" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-foreground hover:bg-secondary transition-colors text-sm font-medium">Cancel</button>
            <button onClick={handleSave} disabled={createLocation.isPending || updateLocation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {createLocation.isPending || updateLocation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      <input className={`${inputClass} w-full max-w-sm`} placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Location Name</TableHead>
              <TableHead className="text-center">Buildings</TableHead>
              <TableHead className="text-center">Units</TableHead>
              <TableHead className="text-center">Rooms</TableHead>
              <TableHead className="text-center">Available</TableHead>
              <TableHead className="text-center">Avail Soon</TableHead>
              <TableHead className="text-center">Reserved</TableHead>
              <TableHead className="text-center">Occupied</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No locations found</TableCell></TableRow>
            ) : filtered.map((loc, i) => {
              const s = locationStats[loc.id] || { buildings: 0, units: 0, rooms: 0, available: 0, availableSoon: 0, pending: 0, occupied: 0 };
              return (
                <TableRow key={loc.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell className="text-center font-semibold">{s.buildings}</TableCell>
                  <TableCell className="text-center font-semibold">{s.units}</TableCell>
                  <TableCell className="text-center font-semibold">{s.rooms}</TableCell>
                  <TableCell className="text-center">
                    {s.available > 0 ? <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400">{s.available}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.availableSoon > 0 ? <Badge variant="secondary" className="bg-primary/15 text-primary">{s.availableSoon}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.pending > 0 ? <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">{s.pending}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.occupied > 0 ? <Badge variant="secondary" className="bg-destructive/15 text-destructive">{s.occupied}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(loc)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(loc.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

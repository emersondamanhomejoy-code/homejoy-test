import { useState, useMemo } from "react";
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from "@/hooks/useLocations";
import { useCondos } from "@/hooks/useCondos";
import { useUnits } from "@/hooks/useRooms";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const locationStats = useMemo(() => {
    const map: Record<string, { buildings: number; units: number; rooms: number }> = {};
    for (const loc of locations) {
      const locCondos = condos.filter(c => c.location_id === loc.id);
      const buildingNames = new Set(locCondos.map(c => c.name));
      const locUnits = units.filter(u => buildingNames.has(u.building));
      const rooms = locUnits.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park"));
      map[loc.id] = { buildings: locCondos.length, units: locUnits.length, rooms: rooms.length };
    }
    return map;
  }, [locations, condos, units]);

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const openCreate = () => { setEditingId(null); setName(""); setShowForm(true); };
  const openEdit = (loc: { id: string; name: string }) => { setEditingId(loc.id); setName(loc.name); setShowForm(true); };

  const handleClose = () => {
    if (name.trim()) {
      setShowCancelConfirm(true);
    } else {
      setShowForm(false);
    }
  };

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

  const { sort, handleSort, sortData } = useTableSort("name");

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const sortedFiltered = sortData(filtered, (loc, key: string) => {
    const s = locationStats[loc.id] || { buildings: 0, units: 0, rooms: 0 };
    const map: Record<string, any> = {
      name: loc.name,
      buildings: s.buildings,
      units: s.units,
      rooms: s.rooms,
    };
    return map[key];
  });
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Locations</div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Location
        </Button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <input className={`${inputClass} w-full`} placeholder="Location name (e.g. Bukit Jalil)" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={createLocation.isPending || updateLocation.isPending}>
              {createLocation.isPending || updateLocation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel? Your unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowForm(false); setShowCancelConfirm(false); setName(""); setEditingId(null); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input className={`${inputClass} w-full max-w-sm`} placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <SortableTableHead sortKey="name" currentSort={sort} onSort={handleSort}>Location Name</SortableTableHead>
              <SortableTableHead sortKey="buildings" currentSort={sort} onSort={handleSort} className="text-center">Total Buildings</SortableTableHead>
              <SortableTableHead sortKey="units" currentSort={sort} onSort={handleSort} className="text-center">Total Units</SortableTableHead>
              <SortableTableHead sortKey="rooms" currentSort={sort} onSort={handleSort} className="text-center">Total Rooms</SortableTableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFiltered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No locations found</TableCell></TableRow>
            ) : sortedFiltered.map((loc, i) => {
               const s = locationStats[loc.id] || { buildings: 0, units: 0, rooms: 0 };
               return (
                 <TableRow key={loc.id}>
                   <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                   <TableCell className="font-medium">{loc.name}</TableCell>
                   <TableCell className="text-center font-semibold">{s.buildings}</TableCell>
                   <TableCell className="text-center font-semibold">{s.units}</TableCell>
                   <TableCell className="text-center font-semibold">{s.rooms}</TableCell>
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

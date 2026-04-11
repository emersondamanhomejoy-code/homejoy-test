import { useState } from "react";
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from "@/hooks/useLocations";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pencil, Trash2, Plus } from "lucide-react";

export function LocationsContent() {
  const { data: locations = [], isLoading } = useLocations();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setShowForm(true);
  };

  const openEdit = (loc: { id: string; name: string }) => {
    setEditingId(loc.id);
    setName(loc.name);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert("Location name is required"); return; }
    try {
      if (editingId) {
        await updateLocation.mutateAsync({ id: editingId, name: name.trim() });
      } else {
        await createLocation.mutateAsync(name.trim());
      }
      setShowForm(false);
      setName("");
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || "Failed to save location");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this location? Condos linked to it will have their location cleared.")) return;
    try {
      await deleteLocation.mutateAsync(id);
    } catch (e: any) {
      alert(e.message || "Failed to delete location");
    }
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
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No locations found</TableCell></TableRow>
            ) : filtered.map((loc, i) => (
              <TableRow key={loc.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{loc.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(loc)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(loc.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

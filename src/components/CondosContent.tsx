import { useState, useMemo, useRef, useCallback } from "react";
import { useCondos, useCreateCondo, useUpdateCondo, useDeleteCondo, Condo, CondoInput } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const emptyCondo: CondoInput = {
  name: "", address: "", description: "", gps_link: "",
  photos: [], deposit_info: "", parking_info: "", amenities: "", location_id: null,
};

export function CondosContent() {
  const { data: condos = [], isLoading } = useCondos();
  const { data: locations = [] } = useLocations();
  const { data: units = [] } = useUnits();
  const createCondo = useCreateCondo();
  const updateCondo = useUpdateCondo();
  const deleteCondo = useDeleteCondo();

  const condoStats = useMemo(() => {
    const map: Record<string, { totalUnits: number; totalRooms: number; available: number; availableSoon: number; reserved: number; occupied: number }> = {};
    for (const c of condos) {
      const condoUnits = units.filter(u => u.building === c.name);
      const rooms = condoUnits.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park"));
      map[c.id] = {
        totalUnits: condoUnits.length,
        totalRooms: rooms.length,
        available: rooms.filter(r => r.status === "Available").length,
        availableSoon: rooms.filter(r => r.status === "Available Soon").length,
        reserved: rooms.filter(r => r.status === "Reserved").length,
        occupied: rooms.filter(r => r.status === "Tenanted" || r.status === "Occupied").length,
      };
    }
    return map;
  }, [condos, units]);

  const [editing, setEditing] = useState<(CondoInput & { id?: string }) | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const openCreate = () => setEditing({ ...emptyCondo });
  const openEdit = (c: Condo) => setEditing({
    id: c.id, name: c.name, address: c.address, description: c.description,
    gps_link: c.gps_link, photos: c.photos || [], deposit_info: c.deposit_info,
    parking_info: c.parking_info, amenities: c.amenities, location_id: c.location_id,
  });

  const handleClose = () => {
    if (editing && (editing.name.trim() || editing.address.trim() || editing.description.trim())) {
      setShowCancelConfirm(true);
    } else {
      setEditing(null);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { alert("Building name is required"); return; }
    try {
      if (editing.id) {
        await updateCondo.mutateAsync({ id: editing.id, ...editing });
      } else {
        await createCondo.mutateAsync(editing);
      }
      setEditing(null);
    } catch (e: any) {
      alert(e.message || "Failed to save building");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building?")) return;
    try { await deleteCondo.mutateAsync(id); } catch (e: any) { alert(e.message); }
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `condos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, file);
      if (error) throw error;
      setEditing({ ...editing, photos: [...editing.photos, path] });
    } catch (e: any) {
      alert(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, photos: editing.photos.filter((_, i) => i !== index) });
  };

  const updateField = (field: string, value: any) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  const filtered = condos.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.location?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Buildings</div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Building
        </Button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Building" : "Add Building"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {editing && (
              <div className="space-y-5 pb-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Building Name *</label>
                    <input className={`${inputClass} w-full`} placeholder="e.g. The Robertson" value={editing.name} onChange={e => updateField("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Location *</label>
                    <select className={`${inputClass} w-full`} value={editing.location_id || ""} onChange={e => updateField("location_id", e.target.value || null)}>
                      <option value="">— Select Location —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address</label>
                    <input className={`${inputClass} w-full`} placeholder="Full address" value={editing.address} onChange={e => updateField("address", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">GPS Link</label>
                    <input className={`${inputClass} w-full`} placeholder="Google Maps link" value={editing.gps_link} onChange={e => updateField("gps_link", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <textarea className={`${inputClass} w-full h-24`} placeholder="Description of the building, nearby facilities..." value={editing.description} onChange={e => updateField("description", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Amenities</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Swimming pool, gym, playground, mini mart..." value={editing.amenities} onChange={e => updateField("amenities", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Deposit Info</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Deposit terms, refundable/non-refundable..." value={editing.deposit_info} onChange={e => updateField("deposit_info", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Parking Info</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Parking type, rates, access card info..." value={editing.parking_info} onChange={e => updateField("parking_info", e.target.value)} />
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <label className="text-xs text-muted-foreground">Photos (optional)</label>
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {editing.photos.map((path, i) => (
                      <div key={i} className="relative group">
                        <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Photo ${i + 1}`} className="h-28 w-full object-cover rounded-lg" />
                        <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    <label className="h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                      <span className="text-2xl text-muted-foreground">+</span>
                      <span className="text-xs text-muted-foreground mt-1">{uploading ? "Uploading..." : "Add Photo"}</span>
                      <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        for (const f of files) await uploadPhoto(f);
                        e.target.value = "";
                      }} />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={createCondo.isPending || updateCondo.isPending}>
              {createCondo.isPending || updateCondo.isPending ? "Saving..." : "Save"}
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
            <AlertDialogAction onClick={() => { setEditing(null); setShowCancelConfirm(false); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input className={`${inputClass} w-full max-w-sm`} placeholder="Search buildings..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Building Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Units</TableHead>
              <TableHead className="text-center">Total Rooms</TableHead>
              <TableHead className="text-center">Available</TableHead>
              <TableHead className="text-center">Avail Soon</TableHead>
              <TableHead className="text-center">Reserved</TableHead>
              <TableHead className="text-center">Occupied</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No buildings found</TableCell></TableRow>
            ) : filtered.map((c, i) => {
              const stats = condoStats[c.id] || { totalUnits: 0, totalRooms: 0, available: 0, availableSoon: 0, reserved: 0, occupied: 0 };
              return (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  {c.address && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.address}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.location?.name || "—"}</TableCell>
                <TableCell className="text-center font-semibold">{stats.totalUnits}</TableCell>
                <TableCell className="text-center font-semibold">{stats.totalRooms}</TableCell>
                <TableCell className="text-center">
                  {stats.available > 0 ? <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400">{stats.available}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-center">
                  {stats.availableSoon > 0 ? <Badge variant="secondary" className="bg-primary/15 text-primary">{stats.availableSoon}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-center">
                  {stats.reserved > 0 ? <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">{stats.reserved}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-center">
                  {stats.occupied > 0 ? <Badge variant="secondary" className="bg-destructive/15 text-destructive">{stats.occupied}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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

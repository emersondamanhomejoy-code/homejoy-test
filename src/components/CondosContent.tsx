import { useState, useMemo } from "react";
import { useCondos, useCreateCondo, useUpdateCondo, useDeleteCondo, Condo, CondoInput } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, Eye, GripVertical } from "lucide-react";

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

  const [editing, setEditing] = useState<(CondoInput & { id?: string }) | null>(null);
  const [viewing, setViewing] = useState<Condo | null>(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const MAX_PHOTOS = 10;

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    if (editing.photos.length >= MAX_PHOTOS) { alert(`Maximum ${MAX_PHOTOS} photos allowed`); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `condos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, file);
      if (error) throw error;
      setEditing(prev => prev ? { ...prev, photos: [...prev.photos, path] } : prev);
    } catch (e: any) { alert(e.message || "Upload failed"); } finally { setUploading(false); }
  };

  const removePhoto = (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, photos: editing.photos.filter((_, i) => i !== index) });
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (index: number) => {
    if (dragIndex === null || !editing) return;
    const newPhotos = [...editing.photos];
    const [moved] = newPhotos.splice(dragIndex, 1);
    newPhotos.splice(index, 0, moved);
    setEditing({ ...editing, photos: newPhotos });
    setDragIndex(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const updateField = (field: string, value: any) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  const filtered = condos.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.location?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.address || "").toLowerCase().includes(search.toLowerCase());
    const matchLocation = !locationFilter || c.location_id === locationFilter;
    return matchSearch && matchLocation;
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  // View stats for the viewing dialog
  const viewStats = viewing ? (condoStats[viewing.id] || { totalUnits: 0, totalRooms: 0, totalCarparks: 0, availableRooms: 0, availableCarparks: 0 }) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Buildings</div>
        <Button onClick={openCreate}>
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
              <TableHead>Location</TableHead>
              <TableHead>Building Name</TableHead>
              <TableHead>Address Preview</TableHead>
              <TableHead className="text-center">Total Units</TableHead>
              <TableHead className="text-center">Total Rooms</TableHead>
              <TableHead className="text-center">Total Carparks</TableHead>
              <TableHead className="text-center">Available Rooms</TableHead>
              <TableHead className="text-center">Available Carparks</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No buildings found</TableCell></TableRow>
            ) : filtered.map((c, i) => {
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
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="h-4 w-4" /></button>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Building Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 pb-4">
              {/* Photos */}
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
                <div><span className="text-muted-foreground">Deposit Info:</span> <span className="font-medium">{viewing.deposit_info || "—"}</span></div>
                <div><span className="text-muted-foreground">Parking Info:</span> <span className="font-medium">{viewing.parking_info || "—"}</span></div>
              </div>
              {viewStats && (
                <div className="grid grid-cols-5 gap-3 pt-2">
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Building" : "Add Building"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
            {editing && (
              <div className="space-y-5 pb-4">
                {/* Photos */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Photos ({editing.photos.length}/{MAX_PHOTOS})</label>
                    <span className="text-xs text-muted-foreground">Drag to reorder</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {editing.photos.map((path, i) => (
                      <div key={path} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={() => handleDrop(i)} onDragEnd={handleDragEnd}
                        className={`relative group cursor-grab active:cursor-grabbing transition-all ${dragOverIndex === i ? "ring-2 ring-primary scale-105" : ""} ${dragIndex === i ? "opacity-50" : ""}`}>
                        <div className="absolute top-1 left-1 z-10 bg-black/50 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="h-3.5 w-3.5 text-white" /></div>
                        <div className="absolute top-1 left-7 z-10 bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">{i + 1}</div>
                        <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Photo ${i + 1}`} className="h-28 w-full object-cover rounded-lg" />
                        <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    {editing.photos.length < MAX_PHOTOS && (
                      <label className="h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                        <span className="text-2xl text-muted-foreground">+</span>
                        <span className="text-xs text-muted-foreground mt-1">{uploading ? "Uploading..." : "Add Photo"}</span>
                        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const remaining = MAX_PHOTOS - (editing?.photos.length || 0);
                          const toUpload = files.slice(0, remaining);
                          for (const f of toUpload) await uploadPhoto(f);
                          if (files.length > remaining) alert(`Only ${remaining} more photo(s) can be added.`);
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>

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
                    <textarea className={`${inputClass} w-full h-24`} placeholder="Description of the building..." value={editing.description} onChange={e => updateField("description", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Amenities</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Swimming pool, gym, playground..." value={editing.amenities} onChange={e => updateField("amenities", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Deposit Info</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Deposit terms..." value={editing.deposit_info} onChange={e => updateField("deposit_info", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Parking Info</label>
                    <textarea className={`${inputClass} w-full h-20`} placeholder="Parking type, rates..." value={editing.parking_info} onChange={e => updateField("parking_info", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
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
            <AlertDialogAction onClick={() => { setEditing(null); setShowCancelConfirm(false); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

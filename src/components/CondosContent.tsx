import { useState, useMemo } from "react";
import { useCondos, useCreateCondo, useUpdateCondo, useDeleteCondo, Condo, CondoInput } from "@/hooks/useCondos";
import { useLocations } from "@/hooks/useLocations";
import { useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, ChevronLeft } from "lucide-react";

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

  // Build stats per condo (matched by building name = condo name)
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

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const openCreate = () => setEditing({ ...emptyCondo });
  const openEdit = (c: Condo) => setEditing({
    id: c.id, name: c.name, address: c.address, description: c.description,
    gps_link: c.gps_link, photos: c.photos || [], deposit_info: c.deposit_info,
    parking_info: c.parking_info, amenities: c.amenities, location_id: c.location_id,
  });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { alert("Condo name is required"); return; }
    try {
      if (editing.id) {
        await updateCondo.mutateAsync({ id: editing.id, ...editing });
      } else {
        await createCondo.mutateAsync(editing);
      }
      setEditing(null);
    } catch (e: any) {
      alert(e.message || "Failed to save condo");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this condo/building?")) return;
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

  // ─── FORM ───
  if (editing) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-2xl font-extrabold">{editing.id ? "Edit Condo" : "Add Condo"}</div>
        <div className="bg-card rounded-lg shadow-sm p-6 space-y-5 border">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Condo Name *</label>
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
              <textarea className={`${inputClass} w-full h-24`} placeholder="Description of the condo, nearby facilities..." value={editing.description} onChange={e => updateField("description", e.target.value)} />
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

          <div className="flex gap-3 justify-end pt-4">
            <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
            <button onClick={handleSave} disabled={createCondo.isPending || updateCondo.isPending} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {createCondo.isPending || updateCondo.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── TABLE ───
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">Condos / Buildings</div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Add Condo
        </button>
      </div>

      <input className={`${inputClass} w-full max-w-sm`} placeholder="Search condos..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Condo Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Units</TableHead>
              <TableHead className="text-center">Available</TableHead>
              <TableHead className="text-center">Avail Soon</TableHead>
              <TableHead className="text-center">Reserved</TableHead>
              <TableHead className="text-center">Occupied</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No condos found</TableCell></TableRow>
            ) : filtered.map((c, i) => {
              const stats = condoStats[c.id] || { totalUnits: 0, available: 0, availableSoon: 0, reserved: 0, occupied: 0 };
              return (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  {c.address && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.address}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.location?.name || "—"}</TableCell>
                <TableCell className="text-center font-semibold">{stats.totalUnits}</TableCell>
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

import { useState } from "react";
import { useLocations } from "@/hooks/useLocations";
import { useCreateCondo, useUpdateCondo, Condo, CondoInput } from "@/hooks/useCondos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export interface AccessItem {
  id: string;
  name: string;
  category: string;
  type: string;
  provided_by: string;
  chargeable: boolean;
  price: number;
  instruction: string;
}

const ACCESS_CATEGORIES = ["Main Entrance", "Lift", "Lobby", "Visitor Registration", "Other"];
const ACCESS_TYPES = ["Face ID", "Access Card", "Sticker", "RFID", "ANPR", "None"];
const PROVIDED_BY = ["Homejoy", "Management Office", "Tenant Self-Prepare"];

const newAccessItem = (): AccessItem => ({
  id: crypto.randomUUID(),
  name: "",
  category: "Main Entrance",
  type: "Access Card",
  provided_by: "Homejoy",
  chargeable: false,
  price: 0,
  instruction: "",
});

interface BuildingFormProps {
  building?: Condo | null;
  onClose: () => void;
}

export function BuildingForm({ building, onClose }: BuildingFormProps) {
  const { data: locations = [] } = useLocations();
  const createCondo = useCreateCondo();
  const updateCondo = useUpdateCondo();
  const isEdit = !!building;

  const [form, setForm] = useState<CondoInput & { access_items: AccessItem[]; visitor_car_parking: string; visitor_motorcycle_parking: string; arrival_instruction: string }>({
    name: building?.name || "",
    address: building?.address || "",
    description: building?.description || "",
    gps_link: building?.gps_link || "",
    photos: building?.photos || [],
    deposit_info: building?.deposit_info || "",
    parking_info: building?.parking_info || "",
    amenities: building?.amenities || "",
    location_id: building?.location_id || null,
    access_items: (building as any)?.access_items || [],
    visitor_car_parking: (building as any)?.visitor_car_parking || "",
    visitor_motorcycle_parking: (building as any)?.visitor_motorcycle_parking || "",
    arrival_instruction: (building as any)?.arrival_instruction || "",
  });

  const [uploading, setUploading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  const inputClass = "px-3 py-2 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const labelClass = "text-xs font-medium text-muted-foreground";

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const isDirty = form.name.trim() || form.address.trim() || form.description.trim() || form.photos.length > 0;

  const handleCancel = () => {
    if (isDirty) setShowCancelConfirm(true);
    else onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Building name is required"); return; }
    try {
      const payload: any = { ...form };
      if (isEdit && building) {
        await updateCondo.mutateAsync({ id: building.id, ...payload });
      } else {
        await createCondo.mutateAsync(payload);
      }
      onClose();
    } catch (e: any) {
      alert(e.message || "Failed to save building");
    }
  };

  // Photo management
  const MAX_PHOTOS = 10;
  const uploadPhoto = async (file: File) => {
    if (form.photos.length >= MAX_PHOTOS) { alert(`Maximum ${MAX_PHOTOS} photos allowed`); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `condos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, file);
      if (error) throw error;
      setForm(prev => ({ ...prev, photos: [...prev.photos, path] }));
    } catch (e: any) { alert(e.message || "Upload failed"); } finally { setUploading(false); }
  };
  const removePhoto = (index: number) => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleDrop = (i: number) => {
    if (dragIndex === null) return;
    const newPhotos = [...form.photos];
    const [moved] = newPhotos.splice(dragIndex, 1);
    newPhotos.splice(i, 0, moved);
    setForm(prev => ({ ...prev, photos: newPhotos }));
    setDragIndex(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  // Access items management
  const addAccessItem = () => setForm(prev => ({ ...prev, access_items: [...prev.access_items, newAccessItem()] }));
  const removeAccessItem = (id: string) => setForm(prev => ({ ...prev, access_items: prev.access_items.filter(a => a.id !== id) }));
  const updateAccessItem = (id: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      access_items: prev.access_items.map(a => a.id === id ? { ...a, [field]: value } : a),
    }));
  };
  const toggleCollapse = (id: string) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold">{isEdit ? "Edit Building" : "Add Building"}</div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={createCondo.isPending || updateCondo.isPending}>
            {createCondo.isPending || updateCondo.isPending ? "Saving..." : "Save Building"}
          </Button>
        </div>
      </div>

      {/* Section 1: Basic Information */}
      <div className="bg-card rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-bold">Basic Information</h2>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Building Photos ({form.photos.length}/{MAX_PHOTOS})</label>
            <span className="text-xs text-muted-foreground">Drag to reorder</span>
          </div>
          <div className="grid grid-cols-5 gap-3 mt-2">
            {form.photos.map((path, i) => (
              <div key={path} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={() => handleDrop(i)} onDragEnd={handleDragEnd}
                className={`relative group cursor-grab active:cursor-grabbing transition-all ${dragOverIndex === i ? "ring-2 ring-primary scale-105" : ""} ${dragIndex === i ? "opacity-50" : ""}`}>
                <div className="absolute top-1 left-1 z-10 bg-black/50 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="h-3.5 w-3.5 text-white" /></div>
                <div className="absolute top-1 left-7 z-10 bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">{i + 1}</div>
                <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Photo ${i + 1}`} className="h-28 w-full object-cover rounded-lg" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
            {form.photos.length < MAX_PHOTOS && (
              <label className="h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <span className="text-2xl text-muted-foreground">+</span>
                <span className="text-xs text-muted-foreground mt-1">{uploading ? "Uploading..." : "Add Photo"}</span>
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  const remaining = MAX_PHOTOS - form.photos.length;
                  for (const f of files.slice(0, remaining)) await uploadPhoto(f);
                  if (files.length > remaining) alert(`Only ${remaining} more photo(s) can be added.`);
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Building Name *</label>
            <input className={`${inputClass} w-full`} placeholder="e.g. The Robertson" value={form.name} onChange={e => updateField("name", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Location *</label>
            <select className={`${inputClass} w-full`} value={form.location_id || ""} onChange={e => updateField("location_id", e.target.value || null)}>
              <option value="">— Select Location —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Address</label>
            <input className={`${inputClass} w-full`} placeholder="Full address" value={form.address} onChange={e => updateField("address", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>GPS Link</label>
            <input className={`${inputClass} w-full`} placeholder="Google Maps link" value={form.gps_link} onChange={e => updateField("gps_link", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea className={`${inputClass} w-full h-24`} placeholder="Description of the building, nearby facilities..." value={form.description} onChange={e => updateField("description", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Amenities</label>
            <textarea className={`${inputClass} w-full h-20`} placeholder="Swimming pool, gym, playground, mini mart..." value={form.amenities} onChange={e => updateField("amenities", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Section 2: Visitor / Access Information */}
      <div className="bg-card rounded-lg border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Visitor / Access Information</h2>
          <Button variant="outline" size="sm" onClick={addAccessItem}>
            <Plus className="h-4 w-4" /> Add Access Item
          </Button>
        </div>

        {form.access_items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            No access items added yet. Click "Add Access Item" to configure building access methods.
          </div>
        )}

        <div className="space-y-4">
          {form.access_items.map((item, idx) => {
            const collapsed = collapsedItems.has(item.id);
            return (
              <div key={item.id} className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 cursor-pointer" onClick={() => toggleCollapse(item.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-muted-foreground">#{idx + 1}</span>
                    <span className="font-medium text-sm">
                      {item.name || "Untitled"} — {item.category} ({item.type})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); removeAccessItem(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Body */}
                {!collapsed && (
                  <div className="p-4 grid md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Access Name *</label>
                      <input className={`${inputClass} w-full`} placeholder="e.g. Lift Access Card" value={item.name} onChange={e => updateAccessItem(item.id, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Access Category</label>
                      <select className={`${inputClass} w-full`} value={item.category} onChange={e => updateAccessItem(item.id, "category", e.target.value)}>
                        {ACCESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Access Type</label>
                      <select className={`${inputClass} w-full`} value={item.type} onChange={e => updateAccessItem(item.id, "type", e.target.value)}>
                        {ACCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Provided By</label>
                      <select className={`${inputClass} w-full`} value={item.provided_by} onChange={e => updateAccessItem(item.id, "provided_by", e.target.value)}>
                        {PROVIDED_BY.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Chargeable</label>
                      <select className={`${inputClass} w-full`} value={item.chargeable ? "yes" : "no"} onChange={e => updateAccessItem(item.id, "chargeable", e.target.value === "yes")}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {item.chargeable && (
                      <div>
                        <label className={labelClass}>Price (RM)</label>
                        <input type="number" className={`${inputClass} w-full`} placeholder="0" value={item.price || ""} onChange={e => updateAccessItem(item.id, "price", Number(e.target.value))} />
                      </div>
                    )}
                    <div className="md:col-span-3">
                      <label className={labelClass}>Instruction Notes</label>
                      <textarea className={`${inputClass} w-full h-16`} placeholder="Special instructions for this access..." value={item.instruction} onChange={e => updateAccessItem(item.id, "instruction", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Visitor / Parking Info */}
      <div className="bg-card rounded-lg border p-6 space-y-5">
        <h2 className="text-lg font-bold">Visitor / Parking Info</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Visitor Car Parking Info</label>
            <textarea className={`${inputClass} w-full h-24`} placeholder="Where visitors can park, rate, time limit..." value={form.visitor_car_parking} onChange={e => updateField("visitor_car_parking", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Visitor Motorcycle Parking Info</label>
            <textarea className={`${inputClass} w-full h-24`} placeholder="Motorcycle parking instructions..." value={form.visitor_motorcycle_parking} onChange={e => updateField("visitor_motorcycle_parking", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Access / Arrival Instruction</label>
            <textarea className={`${inputClass} w-full h-28`} placeholder="Step-by-step arrival instructions that agents can copy and send to tenants..." value={form.arrival_instruction} onChange={e => updateField("arrival_instruction", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={createCondo.isPending || updateCondo.isPending}>
          {createCondo.isPending || updateCondo.isPending ? "Saving..." : "Save Building"}
        </Button>
      </div>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel? Your unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowCancelConfirm(false); onClose(); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

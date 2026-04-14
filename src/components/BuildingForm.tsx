import { useState } from "react";
import { useLocations } from "@/hooks/useLocations";
import { useCreateCondo, useUpdateCondo, Condo, CondoInput } from "@/hooks/useCondos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from "lucide-react";
import { StandardModal } from "@/components/ui/standard-modal";
import { inputClass as sharedInputClass, labelClass as sharedLabelClass } from "@/lib/ui-constants";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";
import { toast } from "sonner";

/* ── Access data shapes ── */
export interface AccessItem {
  id: string;
  access_type: string;
  locations?: string[];
  provided_by: string;
  chargeable_type: string;
  price: number;
  instruction: string;
}

const generateId = () => Math.random().toString(36).slice(2, 10);

const createAccessItem = (type: string): AccessItem => ({
  id: generateId(),
  access_type: type,
  provided_by: "Management Office",
  chargeable_type: "none",
  price: 0,
  instruction: "",
});

const PEDESTRIAN_ACCESS_TYPES = ["Access Card", "Face ID", "None"];
const PEDESTRIAN_LOCATIONS = ["Main Entrance", "Lift", "Guard House", "Lobby"];
const CARPARK_ACCESS_TYPES = ["RFID", "Sticker", "ANPR", "Access Card", "None"];
const MOTORCYCLE_ACCESS_TYPES = ["RFID", "Sticker", "ANPR", "Access Card", "None"];
const PROVIDED_BY_OPTIONS = ["Management Office", "Homejoy"];
const CHARGEABLE_TYPES = [
  { value: "none", label: "Not Chargeable" },
  { value: "deposit", label: "Deposit" },
  { value: "processing_fee", label: "Processing Fee" },
];

interface BuildingFormProps {
  building?: Condo | null;
  onClose: () => void;
}

export function BuildingForm({ building, onClose }: BuildingFormProps) {
  const { data: locations = [] } = useLocations();
  const createCondo = useCreateCondo();
  const updateCondo = useUpdateCondo();
  const isEdit = !!building;

  const existingAccess = (building as any)?.access_items || {};
  const parseItems = (key: string, defaultType: string): AccessItem[] => {
    const raw = existingAccess[key];
    if (Array.isArray(raw)) return raw.map((r: any) => ({ ...createAccessItem(defaultType), ...r, id: r.id || generateId() }));
    if (raw && typeof raw === "object" && raw.access_type) {
      return [{
        id: generateId(),
        access_type: raw.access_type,
        locations: raw.locations,
        provided_by: raw.provided_by || "Management Office",
        chargeable_type: raw.chargeable ? "one_time_fee" : "none",
        price: raw.price || 0,
        instruction: raw.instruction || "",
      }];
    }
    return [];
  };

  const initialForm = {
    name: building?.name || "",
    address: building?.address || "",
    description: building?.description || "",
    gps_link: building?.gps_link || "",
    photos: building?.photos || [],
    deposit_info: building?.deposit_info || "",
    parking_info: building?.parking_info || "",
    amenities: building?.amenities || "",
    location_id: building?.location_id || null,
    visitor_car_parking: (building as any)?.visitor_car_parking || "",
    visitor_motorcycle_parking: (building as any)?.visitor_motorcycle_parking || "",
    arrival_instruction: (building as any)?.arrival_instruction || "",
  };

  const [form, setForm] = useState(initialForm);

  const initialPedestrian = parseItems("pedestrian", "Access Card");
  const initialCarpark = parseItems("carpark", "RFID");
  const initialMotorcycle = parseItems("motorcycle", "RFID");

  const [pedestrianItems, setPedestrianItems] = useState<AccessItem[]>(initialPedestrian);
  const [carparkItems, setCarparkItems] = useState<AccessItem[]>(initialCarpark);
  const [motorcycleItems, setMotorcycleItems] = useState<AccessItem[]>(initialMotorcycle);

  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { errors, validate, clearError } = useFormValidation();
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ details: true, pedestrian: true, carpark: true, motorcycle: true, visitor: true });
  const toggleSection = (key: string) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
  const allExpanded = Object.values(sectionsOpen).every(Boolean);
  const toggleAllSections = () => {
    const newVal = !allExpanded;
    setSectionsOpen({ details: newVal, pedestrian: newVal, carpark: newVal, motorcycle: newVal, visitor: newVal });
  };

  const inputClass = sharedInputClass;
  const labelClass = sharedLabelClass;

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) ||
    JSON.stringify(pedestrianItems) !== JSON.stringify(initialPedestrian) ||
    JSON.stringify(carparkItems) !== JSON.stringify(initialCarpark) ||
    JSON.stringify(motorcycleItems) !== JSON.stringify(initialMotorcycle);

  const handleSave = async () => {
    if (!validate(form, { name: (v) => !v?.trim() ? "Building name is required" : null })) return;
    try {
      const payload: any = {
        ...form,
        access_items: {
          pedestrian: pedestrianItems,
          carpark: carparkItems,
          motorcycle: motorcycleItems,
        },
      };
      if (isEdit && building) {
        await updateCondo.mutateAsync({ id: building.id, ...payload });
      } else {
        await createCondo.mutateAsync(payload);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save building");
    }
  };

  const MAX_PHOTOS = 10;
  const [photoError, setPhotoError] = useState<string | null>(null);
  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `condos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("room-photos").upload(path, file);
      if (error) throw error;
      setForm(prev => ({ ...prev, photos: [...prev.photos, path] }));
    } catch (e: any) { toast.error(e.message || "Upload failed"); } finally { setUploading(false); }
  };
  const removePhoto = (index: number) => { setPhotoError(null); setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) })); };

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

  const updateItem = (
    items: AccessItem[],
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    id: string,
    field: string,
    value: any,
  ) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const toggleLocation = (
    items: AccessItem[],
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    itemId: string,
    loc: string,
  ) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const locs = item.locations || [];
      return { ...item, locations: locs.includes(loc) ? locs.filter(l => l !== loc) : [...locs, loc] };
    }));
  };

  const addItem = (
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    defaultType: string,
  ) => {
    setItems(prev => [...prev, createAccessItem(defaultType)]);
  };

  const removeItem = (
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    id: string,
  ) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    [...parseItems("pedestrian", "Access Card"), ...parseItems("carpark", "RFID"), ...parseItems("motorcycle", "RFID")].forEach(item => {
      if (item.access_type !== "Access Card" || item.provided_by || item.instruction) {
        map[item.id] = true;
      }
    });
    return map;
  });

  const toggleCollapse = (id: string) => setCollapsedItems(prev => ({ ...prev, [id]: !prev[id] }));
  const collapseItem = (id: string) => setCollapsedItems(prev => ({ ...prev, [id]: true }));

  const renderAccessSummary = (item: AccessItem, showLocations: boolean) => {
    const parts: string[] = [item.access_type];
    if (showLocations && item.locations?.length) parts.push(`@ ${item.locations.join(", ")}`);
    if (item.access_type !== "None") {
      parts.push(`· ${item.provided_by}`);
      if (item.chargeable_type !== "none") {
        const label = CHARGEABLE_TYPES.find(c => c.value === item.chargeable_type)?.label || item.chargeable_type;
        parts.push(`· ${label}${item.price ? ` RM${item.price}` : ""}`);
      }
    }
    return parts.join(" ");
  };

  const renderAccessItem = (
    item: AccessItem,
    items: AccessItem[],
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    accessTypes: string[],
    showLocations: boolean,
    index: number,
  ) => {
    const isNone = item.access_type === "None";
    const isCollapsed = !!collapsedItems[item.id];

    if (isCollapsed) {
      return (
        <div key={item.id} className="border rounded-lg p-3 bg-secondary/30 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold mr-2">#{index + 1}</span>
            <span className="text-sm text-foreground truncate">{renderAccessSummary(item, showLocations)}</span>
            {item.instruction && !isNone && (
              <p className="text-xs text-muted-foreground mt-1 truncate">📝 {item.instruction}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => toggleCollapse(item.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => removeItem(setItems, item.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-secondary/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">#{index + 1}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => collapseItem(item.id)} className="p-1.5 rounded-md hover:bg-primary/10 transition-colors text-primary" title="Save & Collapse">
              <Save className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => removeItem(setItems, item.id)} className="text-destructive hover:text-destructive/80 transition-colors p-1">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Access Type</label>
            <select className={`${inputClass} w-full`} value={item.access_type} onChange={e => updateItem(items, setItems, item.id, "access_type", e.target.value)}>
              {accessTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {showLocations && !isNone && (
            <div>
              <label className={labelClass}>Access Location</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PEDESTRIAN_LOCATIONS.map(loc => {
                  const selected = (item.locations || []).includes(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => toggleLocation(items, setItems, item.id, loc)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isNone && (
            <div>
              <label className={labelClass}>Provided By</label>
              <select className={`${inputClass} w-full`} value={item.provided_by} onChange={e => updateItem(items, setItems, item.id, "provided_by", e.target.value)}>
                {PROVIDED_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {!isNone && (
            <div>
              <label className={labelClass}>Chargeable</label>
              <select className={`${inputClass} w-full`} value={item.chargeable_type} onChange={e => {
                const newType = e.target.value;
                const defaultPrices: Record<string, number> = { deposit: 100, processing_fee: 50, none: 0 };
                const newPrice = newType in defaultPrices ? defaultPrices[newType] : item.price;
                setItems(items.map(i => i.id === item.id ? { ...i, chargeable_type: newType, price: newPrice } : i));
              }}>
                {CHARGEABLE_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          {!isNone && item.chargeable_type !== "none" && (
            <div>
              <label className={labelClass}>Price (RM)</label>
              <input type="number" className={`${inputClass} w-full`} placeholder="0" value={item.price || ""} onChange={e => updateItem(items, setItems, item.id, "price", Number(e.target.value))} />
            </div>
          )}

          <div className="md:col-span-2">
            <label className={labelClass}>Instruction Notes</label>
            <textarea className={`${inputClass} w-full h-16`} placeholder="Special instructions..." value={item.instruction} onChange={e => updateItem(items, setItems, item.id, "instruction", e.target.value)} />
          </div>
        </div>
      </div>
    );
  };

  const renderAccessSection = (
    title: string,
    sectionKey: string,
    accessTypes: string[],
    items: AccessItem[],
    setItems: React.Dispatch<React.SetStateAction<AccessItem[]>>,
    defaultType: string,
    showLocations: boolean = false,
  ) => (
    <div className="bg-card rounded-lg border overflow-hidden">
      <button type="button" onClick={() => toggleSection(sectionKey)} className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          <span onClick={e => { e.stopPropagation(); addItem(setItems, defaultType); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-primary hover:bg-secondary transition-colors cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Add
          </span>
          {sectionsOpen[sectionKey] ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>
      {sectionsOpen[sectionKey] && (
        <div className="px-6 pb-6 space-y-3">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
              No access items added. Click "Add" to configure access.
            </div>
          )}
          {items.map((item, i) => renderAccessItem(item, items, setItems, accessTypes, showLocations, i))}
        </div>
      )}
    </div>
  );

  return (
    <StandardModal
      open={true}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={isEdit ? "Edit Building" : "Add Building"}
      size="xl"
      isDirty={isDirty}
      footer={
        <Button onClick={handleSave} disabled={createCondo.isPending || updateCondo.isPending}>
          {createCondo.isPending || updateCondo.isPending ? "Saving..." : "Save"}
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={toggleAllSections} className="text-xs">
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
        <FormErrorBanner errors={errors} />
        {/* Section 1: Building Details */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <button type="button" onClick={() => toggleSection("details")} className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors">
            <h2 className="text-lg font-bold">Building Details</h2>
            {sectionsOpen.details ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </button>
          {sectionsOpen.details && (
            <div className="px-6 pb-6 space-y-5">
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
                        if (files.length > remaining) {
                          setPhotoError(remaining === 0
                            ? `Maximum ${MAX_PHOTOS} photos reached. Remove a photo before adding more.`
                            : `You selected ${files.length} photo(s) but only ${remaining} slot(s) remaining. Please select ${remaining} or fewer.`);
                          e.target.value = "";
                          return;
                        }
                        setPhotoError(null);
                        for (const f of files) await uploadPhoto(f);
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
                {photoError && <p className="text-sm text-destructive mt-1">{photoError}</p>}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div data-field="name">
                  <label className={labelClass}>Building Name *</label>
                  <input className={fieldClass(`${inputClass} w-full`, !!errors.name)} placeholder="e.g. The Robertson" value={form.name} onChange={e => { updateField("name", e.target.value); clearError("name"); }} />
                  <FieldError error={errors.name} />
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
          )}
        </div>

        {/* Visitor / Parking Info - Collapsible */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <button type="button" onClick={() => toggleSection("visitor")} className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors">
            <h2 className="text-lg font-bold">Visitor / Parking Info</h2>
            {sectionsOpen.visitor ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </button>
          {sectionsOpen.visitor && (
            <div className="px-6 pb-6">
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
          )}
        </div>

        {renderAccessSection("Pedestrian Access", "pedestrian", PEDESTRIAN_ACCESS_TYPES, pedestrianItems, setPedestrianItems, "Access Card", true)}
        {renderAccessSection("Car Park Access", "carpark", CARPARK_ACCESS_TYPES, carparkItems, setCarparkItems, "RFID")}
        {renderAccessSection("Motorcycle Access", "motorcycle", MOTORCYCLE_ACCESS_TYPES, motorcycleItems, setMotorcycleItems, "RFID")}
      </div>
    </StandardModal>
  );
}

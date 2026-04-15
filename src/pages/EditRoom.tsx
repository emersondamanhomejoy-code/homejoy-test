import { useState, useEffect } from "react";
import { useUnits, useUpdateRoom, Room } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { StandardModal } from "@/components/ui/standard-modal";
import { inputClass } from "@/lib/ui-constants";
import { toast } from "sonner";

const OPTIONAL_FEATURES = ["Balcony", "Private Bathroom", "Window"];
const bedTypeMaxPax: Record<string, number> = { Single: 1, "Super Single": 1, Queen: 2, King: 2 };

interface EditRoomProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}

export default function EditRoom({ open, onOpenChange, roomId }: EditRoomProps) {
  const { data: units = [], isLoading } = useUnits();
  const updateRoomMut = useUpdateRoom();
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Find the room across all units
  const roomData = (() => {
    for (const unit of units) {
      const room = (unit.rooms || []).find(r => r.id === roomId);
      if (room) return { room, unit };
    }
    return null;
  })();

  const room = roomData?.room;

  useEffect(() => {
    if (!open) setEdits({});
  }, [open]);

  if (!open) return null;

  if (isLoading || !room) {
    return (
      <StandardModal open={open} onOpenChange={onOpenChange} title="Edit Room" size="lg">
        <div className="flex items-center justify-center py-12">
          <span className="text-muted-foreground">{isLoading ? "Loading…" : "Room not found."}</span>
        </div>
      </StandardModal>
    );
  }

  const rc = { ...room, ...edits };
  const isCarpark = (rc as any).room_type === "Car Park" || (rc.room || "").toLowerCase().startsWith("carpark");
  const upRoom = (field: string, value: any) => setEdits(prev => ({ ...prev, [field]: value }));
  const isDirty = Object.keys(edits).length > 0;
  const features = Array.isArray((rc as any).optional_features) ? (rc as any).optional_features : [];
  const showAvailDate = rc.status === "Available Soon";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleSave = async () => {
    if (!isDirty) { onOpenChange(false); return; }
    // Validation
    if (!isCarpark && (rc as any).room_category !== "Studio" && !(rc as any).bed_type?.trim()) {
      toast.error("Bed Type is required."); return;
    }
    if (rc.status === "Available Soon" && !rc.available_date?.trim()) {
      toast.error("Available Date is required when status is Available Soon."); return;
    }
    if (rc.status === "Archived" && !(rc as any).archived_reason?.trim()) {
      toast.error("Archived Reason is required when status is Archived."); return;
    }
    setSaving(true);
    try {
      await updateRoomMut.mutateAsync({ ...room, ...edits } as any);
      toast.success("Room updated.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const title = isCarpark
    ? `Edit Carpark — ${rc.room}`
    : `Edit Room — ${room.building} · ${room.unit} · ${rc.room}`;

  return (
    <StandardModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      isDirty={isDirty}
      footer={<Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
    >
      <div className="space-y-4">
        {/* Photos */}
        <div>
          <label className="text-xs text-muted-foreground">{isCarpark ? "Photos" : "Room Photos"}</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {((rc as any).photos || []).map((path: string, pi: number) => (
              <div key={pi} className="relative group">
                <img src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Photo ${pi + 1}`} className="h-16 w-16 object-cover rounded-lg" />
                <button onClick={() => upRoom("photos", ((rc as any).photos || []).filter((_: any, idx: number) => idx !== pi))}
                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
            {((rc as any).photos || []).length < 10 && (
              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <span className="text-lg text-muted-foreground">+</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  const remaining = 10 - ((rc as any).photos || []).length;
                  const toUpload = files.slice(0, remaining);
                  const newPaths: string[] = [];
                  for (const file of toUpload) {
                    const ext = file.name.split('.').pop();
                    const path = `rooms/${room.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error } = await supabase.storage.from("room-photos").upload(path, file);
                    if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
                    newPaths.push(path);
                  }
                  if (newPaths.length > 0) upRoom("photos", [...((rc as any).photos || []), ...newPaths]);
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
        </div>

        {/* Fields */}
        {isCarpark ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Lot Number</label>
              <input className={`${inputClass} w-full`} placeholder="e.g. B1-23" value={(rc as any).parking_lot || ""} onChange={e => upRoom("parking_lot", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rental (RM)</label>
              <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => upRoom("rent", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              {room.status === "Pending" || room.status === "Occupied" ? (
                <>
                  <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={rc.status} readOnly disabled />
                  <p className="text-xs text-muted-foreground mt-1">
                    {room.status === "Pending" ? "Controlled by Booking workflow." : "Controlled by Move Out workflow."}
                  </p>
                </>
              ) : (
                <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => {
                  upRoom("status", e.target.value);
                  if (e.target.value === "Available Soon" && !rc.available_date) upRoom("available_date", "");
                  if (e.target.value !== "Archived") upRoom("archived_reason", "");
                }}>
                  {room.status === "Available" && <><option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Archived">Archived</option></>}
                  {room.status === "Available Soon" && <><option value="Available Soon">Available Soon</option><option value="Available">Available</option></>}
                  {room.status === "Archived" && <><option value="Archived">Archived</option><option value="Available">Available</option></>}
                </select>
              )}
            </div>
            {rc.status === "Archived" && (
              <div>
                <label className="text-xs text-muted-foreground">Archived Reason *</label>
                <input className={`${inputClass} w-full`} placeholder="Why is this room/carpark archived?" value={(rc as any).archived_reason || ""} onChange={e => upRoom("archived_reason", e.target.value)} />
              </div>
            )}
            {rc.status === "Available Soon" && (
              <div>
                <label className="text-xs text-muted-foreground">Available Date *</label>
                <input className={`${inputClass} w-full`} type="date" value={rc.available_date || ""} onChange={e => upRoom("available_date", e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Remark</label>
              <input className={`${inputClass} w-full`} placeholder="Notes…" value={(rc as any).internal_remark || ""} onChange={e => upRoom("internal_remark", e.target.value)} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Room Code</label>
                <input className={`${inputClass} w-full`} value={rc.room} onChange={e => upRoom("room", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Room Title</label>
                <input className={`${inputClass} w-full`} placeholder="e.g. Balcony Queen Room" value={(rc as any).room_title || ""} onChange={e => upRoom("room_title", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Room Type</label>
                <select className={`${inputClass} w-full`} value={(rc as any).room_category || "Normal Room"} onChange={e => {
                  upRoom("room_category", e.target.value);
                  if (e.target.value === "Studio") upRoom("bed_type", "None");
                  else if ((rc as any).bed_type === "None") upRoom("bed_type", "");
                }}>
                  <option value="Normal Room">Room</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bed Type</label>
                <select className={`${inputClass} w-full`} value={(rc as any).bed_type || ""} onChange={e => {
                  const bt = e.target.value;
                  upRoom("bed_type", bt);
                  if (bt !== "None" && bedTypeMaxPax[bt]) upRoom("max_pax", bedTypeMaxPax[bt]);
                }}>
                  <option value="">—</option>
                  <option value="None">None</option>
                  <option value="Single">Single</option>
                  <option value="Super Single">Super Single</option>
                  <option value="Queen">Queen</option>
                  <option value="King">King</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Wall Type</label>
                <select className={`${inputClass} w-full`} value={(rc as any).wall_type || ""} onChange={e => upRoom("wall_type", e.target.value)}>
                  <option value="">—</option>
                  <option value="Original">Original</option>
                  <option value="Partition">Partition</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max Pax *</label>
                <input className={`${inputClass} w-full`} type="number" min={1} value={rc.max_pax} onChange={e => upRoom("max_pax", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Listed Rental (RM) *</label>
                <input className={`${inputClass} w-full`} type="number" value={rc.rent || ""} onChange={e => upRoom("rent", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                {rc.status === "Pending" || rc.status === "Occupied" ? (
                  <>
                    <input className={`${inputClass} w-full bg-muted cursor-not-allowed`} value={rc.status} readOnly disabled />
                    <p className="text-xs text-muted-foreground mt-1">
                      {rc.status === "Pending" ? "Controlled by Booking workflow." : "Controlled by Move Out workflow."}
                    </p>
                  </>
                ) : (
                  <select className={`${inputClass} w-full`} value={rc.status || "Available"} onChange={e => {
                    upRoom("status", e.target.value);
                    if (e.target.value === "Available Soon" && !rc.available_date) upRoom("available_date", "");
                    if (e.target.value !== "Archived") upRoom("archived_reason", "");
                  }}>
                    {rc.status === "Available" && <><option value="Available">Available</option><option value="Available Soon">Available Soon</option><option value="Archived">Archived</option></>}
                    {rc.status === "Available Soon" && <><option value="Available Soon">Available Soon</option><option value="Available">Available</option></>}
                    {rc.status === "Archived" && <><option value="Archived">Archived</option><option value="Available">Available</option></>}
                  </select>
                )}
              </div>
              {rc.status === "Archived" && (
                <div>
                  <label className="text-xs text-muted-foreground">Archived Reason *</label>
                  <input className={`${inputClass} w-full`} placeholder="Why is this room archived?" value={(rc as any).archived_reason || ""} onChange={e => upRoom("archived_reason", e.target.value)} />
                </div>
              )}
              {showAvailDate && (
                <div>
                  <label className="text-xs text-muted-foreground">Available Date</label>
                  <input className={`${inputClass} w-full`} type="date" value={rc.available_date || ""} onChange={e => upRoom("available_date", e.target.value)} />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Features</label>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_FEATURES.map(feat => {
                  const selected = features.includes(feat);
                  return (
                    <button key={feat} type="button"
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-accent"}`}
                      onClick={() => upRoom("optional_features", selected ? features.filter((f: string) => f !== feat) : [...features, feat])}
                    >{feat}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Remark</label>
              <input className={`${inputClass} w-full`} placeholder="Internal notes…" value={(rc as any).internal_remark || ""} onChange={e => upRoom("internal_remark", e.target.value)} />
            </div>
          </>
        )}
      </div>
    </StandardModal>
  );
}

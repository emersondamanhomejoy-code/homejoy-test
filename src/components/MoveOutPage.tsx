import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface OccupiedRoom {
  id: string;
  building: string;
  unit: string;
  room: string;
  room_title: string;
  room_type: string;
  status: string;
  tenant_gender: string;
  location: string;
  rent: number;
}

const MOVE_OUT_TYPES = [
  "Tenancy Ended",
  "Early Move-out",
  "Internal Transfer",
  "Eviction",
  "Parking Returned",
  "Other",
];

const NEXT_STATUS_OPTIONS = [
  { value: "Available", label: "Available" },
  { value: "Available Soon", label: "Available Soon" },
  { value: "Archived", label: "Archived" },
];

export function MoveOutPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const queryClient = useQueryClient();
  const { data: roomsData = [] } = useRooms();

  const [showMoveOutDialog, setShowMoveOutDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<OccupiedRoom | null>(null);
  const [moveOutForm, setMoveOutForm] = useState({
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    moveOutType: "",
    reason: "",
    nextStatus: "Available",
    assetType: "Room",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Get occupied rooms (status = Occupied or Pending)
  const occupiedRooms = useMemo(() => {
    return roomsData
      .filter(r => r.status === "Occupied" || r.status === "Pending")
      .map(r => ({
        id: r.id,
        building: r.building,
        unit: r.unit,
        room: r.room,
        room_title: r.room_title || "",
        room_type: r.room_type || "",
        status: r.status,
        tenant_gender: r.tenant_gender || "",
        location: r.location || "",
        rent: r.rent || 0,
      })) as OccupiedRoom[];
  }, [roomsData]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return occupiedRooms;
    const s = search.toLowerCase();
    return occupiedRooms.filter(r =>
      r.building.toLowerCase().includes(s) ||
      r.unit.toLowerCase().includes(s) ||
      r.room.toLowerCase().includes(s) ||
      r.room_title.toLowerCase().includes(s) ||
      r.tenant_gender.toLowerCase().includes(s)
    );
  }, [occupiedRooms, search]);

  const handleSelectRoom = (room: OccupiedRoom) => {
    setSelectedRoom(room);
    setMoveOutForm({
      effectiveDate: format(new Date(), "yyyy-MM-dd"),
      moveOutType: "",
      reason: "",
      nextStatus: "Available",
      assetType: room.room_type === "Car Park" ? "Carpark" : "Room",
    });
    setShowMoveOutDialog(true);
  };

  const handleMoveOut = async () => {
    if (!user || !selectedRoom) return;
    setSaving(true);
    try {
      // Update room status
      await supabase.from("rooms").update({
        status: moveOutForm.nextStatus,
        tenant_gender: "",
        tenant_race: "",
        pax_staying: 0,
        tenancy_start_date: null,
        tenancy_end_date: null,
      }).eq("id", selectedRoom.id);

      // Deactivate tenant_rooms bindings
      const { data: activeBindings } = await supabase
        .from("tenant_rooms")
        .select("id")
        .eq("room_id", selectedRoom.id)
        .eq("status", "active");

      if (activeBindings && activeBindings.length > 0) {
        for (const binding of activeBindings) {
          await supabase.from("tenant_rooms").update({ status: "moved_out" }).eq("id", binding.id);
        }
      }

      await logActivity("move_out", "room", selectedRoom.id, {
        building: selectedRoom.building,
        unit: selectedRoom.unit,
        room: selectedRoom.room,
        move_out_type: moveOutForm.moveOutType,
        reason: moveOutForm.reason,
        effective_date: moveOutForm.effectiveDate,
        next_status: moveOutForm.nextStatus,
        asset_type: moveOutForm.assetType,
      });

      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_rooms"] });
      toast.success(`Move-out completed — ${selectedRoom.building} ${selectedRoom.unit} ${selectedRoom.room} set to ${moveOutForm.nextStatus}`);
      setShowMoveOutDialog(false);
      setShowConfirm(false);
      setSelectedRoom(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to process move-out");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <div className="py-10 text-center text-muted-foreground">Only Admin and Super Admin can access Move Out.</div>;
  }

  const fieldClassName = "w-full rounded-lg border bg-secondary px-4 py-3 text-sm text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClassName = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Move Out</h2>
      </div>

      <p className="text-sm text-muted-foreground">Select an occupied or pending room/carpark to process move-out. This is the official way to release active occupancy.</p>

      <Input placeholder="Search building, unit, room, tenant..." className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Building</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Unit</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Room</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tenant Info</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Rent</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No occupied rooms found</td></tr>
            ) : filteredRooms.map(room => (
              <tr key={room.id} className="border-b hover:bg-muted/30">
                <td className="p-3">{room.building}</td>
                <td className="p-3">{room.unit}</td>
                <td className="p-3 font-medium">{room.room}</td>
                <td className="p-3">{room.room_type}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${room.status === "Occupied" ? "bg-orange-500/20 text-orange-600" : "bg-blue-500/20 text-blue-600"}`}>
                    {room.status}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{room.tenant_gender || "—"}</td>
                <td className="p-3">RM {room.rent}</td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="destructive" onClick={() => handleSelectRoom(room)}>Move Out</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Move Out Form Dialog */}
      <Dialog open={showMoveOutDialog} onOpenChange={(open) => !saving && setShowMoveOutDialog(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Move-Out</DialogTitle>
          </DialogHeader>
          {selectedRoom && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="text-sm font-bold uppercase tracking-wide text-muted-foreground border-b border-border pb-2">Room Details</div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{selectedRoom.room_type}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">Current Status</span>
                  <span className="font-medium">{selectedRoom.status}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={labelClassName}>Asset Type</label>
                  <select className={fieldClassName} value={moveOutForm.assetType} onChange={(e) => setMoveOutForm(f => ({ ...f, assetType: e.target.value }))}>
                    <option value="Room">Room</option>
                    <option value="Carpark">Carpark</option>
                    <option value="Room + Carpark">Room + Carpark</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Effective Date *</label>
                  <Input type="date" value={moveOutForm.effectiveDate} onChange={(e) => setMoveOutForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Move Out Type *</label>
                  <select className={fieldClassName} value={moveOutForm.moveOutType} onChange={(e) => setMoveOutForm(f => ({ ...f, moveOutType: e.target.value }))}>
                    <option value="">— Select —</option>
                    {MOVE_OUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Reason / Notes</label>
                  <Textarea placeholder="Enter reason or notes..." value={moveOutForm.reason} onChange={(e) => setMoveOutForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Next Room Status *</label>
                  <select className={fieldClassName} value={moveOutForm.nextStatus} onChange={(e) => setMoveOutForm(f => ({ ...f, nextStatus: e.target.value }))}>
                    {NEXT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveOutDialog(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={() => setShowConfirm(true)} disabled={!moveOutForm.moveOutType || !moveOutForm.effectiveDate}>
              Process Move-Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={(open) => !saving && setShowConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Move-Out</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRoom && (
                <>
                  Are you sure you want to process move-out for <strong>{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</strong>?
                  <br /><br />
                  This will release the occupancy, remove tenant binding, and set the room status to <strong>{moveOutForm.nextStatus}</strong>.
                  <br /><br />
                  <strong>Move Out Type:</strong> {moveOutForm.moveOutType}<br />
                  <strong>Effective Date:</strong> {moveOutForm.effectiveDate}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMoveOut} disabled={saving} className="bg-destructive text-destructive-foreground">
              {saving ? "Processing..." : "Confirm Move-Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

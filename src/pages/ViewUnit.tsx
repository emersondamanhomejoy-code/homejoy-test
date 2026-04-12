import { useNavigate, useParams } from "react-router-dom";
import { useUnits, Room } from "@/hooks/useRooms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Eye } from "lucide-react";

export default function ViewUnit() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { data: units = [], isLoading } = useUnits();

  const unit = units.find(u => u.id === unitId);
  const rooms = (unit?.rooms || []).filter(r => (r as any).room_type !== "Car Park" && r.room !== undefined && !(r.room || "").toLowerCase().startsWith("carpark"));
  const carparks = (unit?.rooms || []).filter(r => (r as any).room_type === "Car Park" || (r.room || "").toLowerCase().startsWith("carpark"));

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground">Loading…</span></div>;
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="text-muted-foreground">Unit not found.</span>
        <Button variant="outline" onClick={() => navigate("/admin", { state: { adminTab: "units" } })}>Back to Units</Button>
      </div>
    );
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin", { state: { adminTab: "units" } })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Unit Details</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── Section 1: Unit Summary ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Unit Summary</h2>

          {/* Common Area Photos */}
          {((unit as any).common_photos || []).length > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common Area Photos</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {((unit as any).common_photos as string[]).map((path, i) => (
                  <img key={i} src={`${supabaseUrl}/storage/v1/object/public/room-photos/${path}`} alt={`Common ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border" />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <InfoField label="Location" value={unit.location} />
            <InfoField label="Building" value={unit.building} />
            <InfoField label="Unit Number" value={unit.unit} />
            <InfoField label="Unit Type" value={unit.unit_type} />
            <InfoField label="Maximum Occupants" value={String(unit.unit_max_pax)} />
            <InfoField label="Rental Deposit (Months)" value={String((unit as any).deposit_multiplier ?? 1.5)} />
            <InfoField label="Admin Fee (RM)" value={String((unit as any).admin_fee ?? 330)} />
            <InfoField label="Meter Type" value={(unit as any).meter_type || "—"} />
            <InfoField label="Meter Rate (RM/kWh)" value={String((unit as any).meter_rate ?? 0)} />
            <InfoField label="Main Door Passcode" value={unit.passcode || "—"} />
            <InfoField label="WiFi Name" value={(unit as any).wifi_name || "—"} />
            <InfoField label="WiFi Password" value={(unit as any).wifi_password || "—"} />
            <div>
              <span className="text-xs text-muted-foreground">Internal Only</span>
              <p className="text-sm font-medium mt-0.5">{(unit as any).internal_only ? "🔒 Yes" : "No"}</p>
            </div>
          </div>
        </section>

        {/* ── Section 2: Rooms ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Rooms in This Unit</h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Bed Type</TableHead>
                    <TableHead>Wall Type</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-center">Max Pax</TableHead>
                    <TableHead className="text-right">Rental (RM)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Pax Staying</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map(room => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.room.replace(/^Room\s+/i, "")}</TableCell>
                      <TableCell>{room.bed_type || "—"}</TableCell>
                      <TableCell>{(room as any).wall_type || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const feats = [...((room as any).optional_features || [])];
                            if (((room as any).room_category === "Studio" || room.room_type === "Studio") && !feats.includes("Studio")) feats.unshift("Studio");
                            return feats.length > 0 ? feats.map((f: string) => (
                              <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                            )) : <span className="text-muted-foreground">—</span>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{room.max_pax}</TableCell>
                      <TableCell className="text-right">{room.rent}</TableCell>
                      <TableCell><StatusBadge status={room.status} availableDate={room.available_date} /></TableCell>
                      <TableCell className="text-center">{room.pax_staying || 0}</TableCell>
                      <TableCell>{(room as any).tenant_nationality || "—"}</TableCell>
                      <TableCell>{room.tenant_gender || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View Room" onClick={() => navigate(`/photos/${room.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* ── Section 3: Carparks ── */}
        <section className="space-y-4 pb-8">
          <h2 className="text-lg font-semibold border-b border-border pb-2">Carparks</h2>
          {carparks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No carparks configured.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carpark Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carparks.map(cp => (
                    <TableRow key={cp.id}>
                      <TableCell className="font-medium">🅿️ {cp.room}</TableCell>
                      <TableCell><StatusBadge status={cp.status} /></TableCell>
                      <TableCell>{(cp as any).assigned_to || "—"}</TableCell>
                      <TableCell>{(cp as any).internal_remark || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}

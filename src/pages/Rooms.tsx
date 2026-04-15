import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { Badge } from "@/components/ui/badge";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Eye, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StandardModal } from "@/components/ui/standard-modal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";

export default function Rooms() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useRooms();

  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("mix");
  const [selectedStatus, setSelectedStatus] = useState<string>("Available");
  const [assetTab, setAssetTab] = useState<"rooms" | "carparks">("rooms");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { sort, handleSort, sortData } = useTableSort("building");
  const [showBooking, setShowBooking] = useState(false);
  const [bookingRoomId, setBookingRoomId] = useState("");
  const [viewingRoom, setViewingRoom] = useState<any>(null);
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    else if (!loading && user && role && role !== "agent") navigate("/admin", { replace: true });
  }, [user, role, loading, navigate]);

  // Filter by asset tab and internal_only
  const allRooms = useMemo(() => {
    return (rooms ?? []).filter((r) => {
      if (r.internal_only) return false;
      const isCarPark = r.room_type === "Car Park";
      return assetTab === "carparks" ? isCarPark : !isCarPark;
    });
  }, [rooms, assetTab]);

  // Derive filter options
  const locations = useMemo(() => {
    const set = new Set(allRooms.map((r) => r.location).filter(Boolean));
    return Array.from(set).sort();
  }, [allRooms]);

  const buildings = useMemo(() => {
    const source = selectedLocations.length
      ? allRooms.filter((r) => selectedLocations.includes(r.location))
      : allRooms;
    const set = new Set(source.map((r) => r.building).filter(Boolean));
    return Array.from(set).sort();
  }, [allRooms, selectedLocations]);

  const statuses = useMemo(() => {
    const set = new Set(allRooms.map((r) => r.status).filter(Boolean));
    return Array.from(set).sort();
  }, [allRooms]);

  // Filtered rows
  const filtered = useMemo(() => {
    let list = allRooms;
    if (selectedStatus !== "all") list = list.filter((r) => r.status === selectedStatus);
    if (selectedLocations.length) list = list.filter((r) => selectedLocations.includes(r.location));
    if (selectedBuildings.length) list = list.filter((r) => selectedBuildings.includes(r.building));
    if (selectedGender !== "mix") {
      list = list.filter((r) => r.unit_type?.toLowerCase().includes(selectedGender));
    }
    return sortData(list, (r: any, key: string) => {
      const map: Record<string, any> = {
        location: r.location,
        building: r.building,
        unit: r.unit,
        room: r.room,
        room_type: r.room_type,
        unit_type: r.unit_type,
        rent: r.rent,
        max_pax: r.max_pax,
        status: r.status,
      };
      return map[key];
    });
  }, [allRooms, selectedLocations, selectedBuildings, selectedGender, selectedStatus, sort]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocations, selectedBuildings, selectedGender, selectedStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const applyLocations = (next: string[]) => {
    setSelectedLocations(next);
    // Reset buildings that no longer match
    if (next.length) {
      setSelectedBuildings((prev) => {
        const validBuildings = new Set(allRooms.filter((r) => next.includes(r.location)).map((r) => r.building));
        return prev.filter((b) => validBuildings.has(b));
      });
    }
  };

  const applyBuildings = (next: string[]) => setSelectedBuildings(next);

  const removeLocation = (val: string) => {
    const next = selectedLocations.filter((l) => l !== val);
    applyLocations(next);
  };

  const removeBuilding = (val: string) => setSelectedBuildings((prev) => prev.filter((b) => b !== val));

  const clearFilters = () => {
    setSelectedLocations([]);
    setSelectedBuildings([]);
    setSelectedGender("mix");
    setSelectedStatus("Available");
  };

  const hasFilters = selectedLocations.length > 0 || selectedBuildings.length > 0 || selectedGender !== "mix" || selectedStatus !== "Available";

  if (loading || !user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgentSidebar onTabChange={(tab) => navigate("/admin", { state: { page: tab } })} />
        <div className="flex-1 flex flex-col">
          {/* Announcement Banner */}
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-8 py-3 border-b border-border">
            <p className="text-center text-sm font-medium text-foreground">
              📢 New commission structure effective from 1st July 2025.{" "}
              <a href="#" className="text-primary underline">Learn More</a>
            </p>
          </div>

          {/* Main Content */}
          <main className="flex-1 p-8 overflow-auto">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Rooms & Car Parks</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Browse and filter available rooms and car parks across all locations.
                </p>
              </div>

              {/* Asset type toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setAssetTab("rooms"); clearFilters(); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${assetTab === "rooms" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Rooms
                </button>
                <button
                  onClick={() => { setAssetTab("carparks"); clearFilters(); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${assetTab === "carparks" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Car Parks
                </button>
              </div>

              {/* Filters */}
              <div className="bg-card rounded-xl shadow-sm border border-border p-5">
                <div className="flex flex-wrap items-end gap-4">
                   {/* Location */}
                  <MultiSelectFilter
                    label="Location"
                    placeholder="Select location"
                    options={locations}
                    selected={selectedLocations}
                    onApply={applyLocations}
                    className="min-w-[200px]"
                  />

                  {/* Building */}
                  <MultiSelectFilter
                    label="Building / Condo"
                    placeholder="Select building"
                    options={buildings}
                    selected={selectedBuildings}
                    onApply={applyBuildings}
                    className="min-w-[200px]"
                  />

                  {/* Gender */}
                  <div className="space-y-1.5 min-w-[160px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Type</label>
                    <Select onValueChange={setSelectedGender} value={selectedGender}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mix">Mixed Gender</SelectItem>
                        <SelectItem value="female">Female Only</SelectItem>
                        <SelectItem value="male">Male Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5 min-w-[160px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                    <Select onValueChange={setSelectedStatus} value={selectedStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {/* Active filter chips */}
                {(selectedLocations.length > 0 || selectedBuildings.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedLocations.map((l) => (
                      <Badge key={`loc-${l}`} variant="secondary" className="gap-1 capitalize cursor-pointer" onClick={() => removeLocation(l)}>
                        {l} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    {selectedBuildings.map((b) => (
                      <Badge key={`bld-${b}`} variant="outline" className="gap-1 cursor-pointer" onClick={() => removeBuilding(b)}>
                        {b} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                <h3 className="font-semibold text-foreground">
                  {selectedStatus === "all" ? (assetTab === "rooms" ? "All Rooms" : "All Car Parks") : `${selectedStatus} ${assetTab === "rooms" ? "Rooms" : "Car Parks"}`}
                </h3>
                </div>
                {isLoading ? (
                  <div className="p-12 text-center text-muted-foreground">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No {assetTab === "rooms" ? "rooms" : "car parks"} match your filters.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <SortableTableHead sortKey="location" currentSort={sort} onSort={handleSort}>Location</SortableTableHead>
                            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                            <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                             <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Code</SortableTableHead>
                            {assetTab === "rooms" && <TableHead>Room Title</TableHead>}
                            <SortableTableHead sortKey="rent" currentSort={sort} onSort={handleSort} className="text-right">Rent (RM)</SortableTableHead>
                            <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                            <TableHead className="text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRooms.map((room) => (
                            <TableRow key={room.id} className="hover:bg-muted/30 cursor-pointer">
                              <TableCell className="capitalize text-muted-foreground">{room.location || "N/A"}</TableCell>
                              <TableCell className="font-medium text-foreground">{room.building || "N/A"}</TableCell>
                              <TableCell>{room.unit || "N/A"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">{room.room}</Badge>
                              </TableCell>
                              {assetTab === "rooms" && <TableCell className="font-medium">{(room as any).room_title || "N/A"}</TableCell>}
                              <TableCell className="text-right font-semibold tabular-nums">{room.rent.toLocaleString()}</TableCell>
                              <TableCell><StatusBadge status={room.status} /></TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewingRoom(room)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" onClick={() => { setBookingRoomId(room.id); setShowBooking(true); }}>
                                    Book
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Show</span>
                        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                          <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                        <span>per page</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      <CreateBookingDialog open={showBooking} onOpenChange={o => { setShowBooking(o); if (!o) setBookingRoomId(""); }} preSelectedRoomId={bookingRoomId} />

      {/* View Room Modal */}
      <StandardModal
        open={!!viewingRoom}
        onOpenChange={(o) => { if (!o) setViewingRoom(null); }}
        title={viewingRoom && (viewingRoom.room_type === "Car Park" || (viewingRoom.room || "").toLowerCase().startsWith("carpark")) ? "Car Park Details" : "Room Details"}
        size="lg"
        hideCancel
        footer={<Button variant="outline" onClick={() => setViewingRoom(null)}>Close</Button>}
      >
        {viewingRoom && <AgentRoomViewContent room={viewingRoom} assetTab={assetTab} />}
      </StandardModal>
    </SidebarProvider>
  );
}

/* ─── Copy Button ─── */
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/* ─── Agent Room View Content ─── */

function AgentRoomViewContent({ room, assetTab }: { room: any; assetTab: "rooms" | "carparks" }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isCarpark = assetTab === "carparks";
  const { data: allRooms } = useRooms();
  const [accordionValues, setAccordionValues] = useState<string[]>(["photos", "details", "otherRooms"]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [otherTenants, setOtherTenants] = useState<Record<string, { nationality?: string; occupation?: string }>>({});

  const photoUrls = useMemo(() => {
    if (!Array.isArray(room.photos) || room.photos.length === 0) return [];
    return (room.photos as string[]).map((path: string) => `${supabaseUrl}/storage/v1/object/public/room-photos/${path}`);
  }, [room.photos, supabaseUrl]);

  // Other rooms in same unit
  const otherRooms = useMemo(() => {
    if (!allRooms || !room.unit_id) return [];
    return allRooms.filter((r) => r.unit_id === room.unit_id && r.id !== room.id && r.room_type !== "Car Park").sort((a, b) => a.room.localeCompare(b.room));
  }, [allRooms, room.unit_id, room.id]);

  const effectiveRemaining = (room.max_pax || 0) - (room.pax_staying || 0);

  const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    if (!value || value === "—" || value === "") return null;
    return <div><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></div>;
  };

  const formatUnitType = (v: string) => {
    if (!v) return "";
    if (v.toLowerCase().includes("female")) return "Female Unit";
    if (v.toLowerCase().includes("male")) return "Male Unit";
    return v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const feats = Array.isArray(room.optional_features) ? room.optional_features : [];
  const sectionKeys = [...(photoUrls.length > 0 ? ["photos"] : []), "details", "otherRooms"];

  // Build copy text helpers
  const buildRoomDetailsText = () => {
    const lines: string[] = [];
    if (!isCarpark) {
      if (room.room_title || room.room) lines.push(`Room: ${room.room_title || room.room}`);
      if (room.room_category || room.room_type) lines.push(`Room Type: ${room.room_category || room.room_type}`);
      if (room.unit_type) lines.push(`Unit Type: ${formatUnitType(room.unit_type)}`);
      if (room.bed_type) lines.push(`Bed Type: ${room.bed_type}`);
      if (room.wall_type) lines.push(`Wall Type: ${room.wall_type}`);
      lines.push(`Listed Rent: RM${room.rent}`);
      lines.push(`Status: ${room.status}`);
      if (room.available_date) lines.push(`Available On: ${room.available_date}`);
      lines.push(`Remaining Pax: ${effectiveRemaining}`);
    } else {
      lines.push(`Listed Rent: RM${room.rent}`);
      if (room.parking_lot) lines.push(`Parking Lot: ${room.parking_lot}`);
      lines.push(`Status: ${room.status}`);
    }
    if (feats.length > 0) lines.push(`Features: ${feats.join(", ")}`);
    return lines.join("\n");
  };

  const buildHousematesText = () => {
    if (otherRooms.length === 0) return "No housemates.";
    return otherRooms.map((r) => {
      const t = otherTenants[r.id];
      const parts = [r.room, `${r.pax_staying || 0} pax`];
      if (t?.nationality) parts.push(t.nationality);
      if (r.tenant_gender) parts.push(r.tenant_gender);
      if (t?.occupation) parts.push(t.occupation);
      return parts.join(" ");
    }).join("\n");
  };

  const buildPhotoLinksText = () => photoUrls.join("\n");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {isCarpark ? `Carpark ${room.room.replace(/^Carpark\s*/i, "")}` : `Room ${room.room.replace(/^Room\s+/i, "")}`}
          {room.room_title ? ` — ${room.room_title}` : ""}
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAccordionValues(prev => prev.length >= sectionKeys.length ? [] : [...sectionKeys])}>
          {accordionValues.length >= sectionKeys.length ? "Collapse All" : "Expand All"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">{room.building} · {room.unit} · {room.location}</div>

      <Accordion type="multiple" value={accordionValues} onValueChange={setAccordionValues} className="space-y-2">
        {photoUrls.length > 0 && (
          <AccordionItem value="photos" className="border rounded-lg px-4">
            <div className="flex items-center justify-between">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline flex-1">Room Photos</AccordionTrigger>
              <CopyBtn text={buildPhotoLinksText()} label="Copy Photos Link" />
            </div>
            <AccordionContent>
              <div className="flex flex-wrap gap-3">
                {photoUrls.map((url, i) => (
                  <img key={i} src={`${url}?width=160&height=160`} alt={`Photo ${i + 1}`} loading="lazy" width={80} height={80} className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxIndex(i)} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="details" className="border rounded-lg px-4">
          <div className="flex items-center justify-between">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline flex-1">Room Details</AccordionTrigger>
            <CopyBtn text={buildRoomDetailsText()} label="Copy Room Details" />
          </div>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {!isCarpark && (
                <>
                  <DetailRow label="Room" value={room.room_title || room.room} />
                  <DetailRow label="Room Type" value={room.room_category || room.room_type} />
                  <DetailRow label="Unit Type" value={formatUnitType(room.unit_type)} />
                  <DetailRow label="Bed Type" value={room.bed_type} />
                  <DetailRow label="Wall Type" value={room.wall_type} />
                  <div><span className="text-muted-foreground">Listed Rent:</span> <span className="font-medium">RM{room.rent}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={room.status} availableDate={room.available_date} /></div>
                  <DetailRow label="Available On" value={room.available_date} />
                  <div><span className="text-muted-foreground">Remaining Pax:</span> <span className="font-medium">{effectiveRemaining}</span></div>
                </>
              )}
              {isCarpark && (
                <>
                  <div><span className="text-muted-foreground">Listed Rent:</span> <span className="font-medium">RM{room.rent}</span></div>
                  <DetailRow label="Parking Lot" value={room.parking_lot} />
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={room.status} availableDate={room.available_date} /></div>
                </>
              )}
              {feats.length > 0 && (
                <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Features:</span> <span className="font-medium">{feats.join(", ")}</span></div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="otherRooms" className="border rounded-lg px-4">
          <div className="flex items-center justify-between">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline flex-1">Other Rooms in Unit</AccordionTrigger>
            <CopyBtn text={buildOtherRoomsText()} label="Copy Other Rooms" />
          </div>
          <AccordionContent>
            {otherRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other rooms in this unit.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Pax</TableHead>
                      <TableHead className="text-xs">Gender</TableHead>
                      <TableHead className="text-xs">Race</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherRooms.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.room}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs">{r.pax_staying || 0}/{r.max_pax || 0}</TableCell>
                        <TableCell className="text-xs">{r.tenant_gender || "—"}</TableCell>
                        <TableCell className="text-xs">{r.tenant_race || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {lightboxIndex !== null && <PhotoLightbox photos={photoUrls} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />}
    </div>
  );
}
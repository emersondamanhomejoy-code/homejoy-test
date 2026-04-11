import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { Badge } from "@/components/ui/badge";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
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
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function Rooms() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useRooms();

  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("Available");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    else if (!loading && user && role && role !== "agent") navigate("/old", { replace: true });
  }, [user, role, loading, navigate]);

  // All non-internal rooms (exclude Car Park), will filter by status
  const allRooms = useMemo(
    () => (rooms ?? []).filter((r) => !r.internal_only && r.room_type !== "Car Park"),
    [rooms]
  );

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
    if (selectedGender !== "all") {
      list = list.filter((r) => r.unit_type?.toLowerCase().includes(selectedGender));
    }
    return list;
  }, [allRooms, selectedLocations, selectedBuildings, selectedGender, selectedStatus]);

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
    setSelectedGender("all");
    setSelectedStatus("Available");
  };

  const hasFilters = selectedLocations.length > 0 || selectedBuildings.length > 0 || selectedGender !== "all" || selectedStatus !== "Available";

  if (loading || !user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgentSidebar />
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
                <h2 className="text-2xl font-bold text-foreground">Available Rooms</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Browse and filter available rooms across all locations.
                </p>
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
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="female">Female Unit</SelectItem>
                        <SelectItem value="male">Male Unit</SelectItem>
                        <SelectItem value="mix">Mix Unit</SelectItem>
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
                  {selectedStatus === "all" ? "All Rooms" : `${selectedStatus} Rooms`}
                </h3>
                </div>
                {isLoading ? (
                  <div className="p-12 text-center text-muted-foreground">Loading rooms…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No available rooms match your filters.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Location</TableHead>
                            <TableHead>Building</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Room Type</TableHead>
                            <TableHead>Unit Type</TableHead>
                            <TableHead className="text-right">Rent (RM)</TableHead>
                            <TableHead className="text-center">Max Pax</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRooms.map((room) => (
                            <TableRow key={room.id} className="hover:bg-muted/30 cursor-pointer">
                              <TableCell className="capitalize text-muted-foreground">{room.location || "—"}</TableCell>
                              <TableCell className="font-medium text-foreground">{room.building || "—"}</TableCell>
                              <TableCell>{room.unit}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">{room.room}</Badge>
                              </TableCell>
                              <TableCell>{room.room_type || room.bed_type || "—"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    room.unit_type?.toLowerCase().includes("female")
                                      ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                                      : room.unit_type?.toLowerCase().includes("male") && !room.unit_type?.toLowerCase().includes("female")
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                      : ""
                                  }
                                >
                                  {room.unit_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">{room.rent.toLocaleString()}</TableCell>
                              <TableCell className="text-center">{room.max_pax}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{room.status}</TableCell>
                              <TableCell className="text-center">
                                <Button size="sm" onClick={() => navigate(`/book/${room.id}`)}>
                                  Book
                                </Button>
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
    </SidebarProvider>
  );
}

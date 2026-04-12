import { useState, useMemo } from "react";
import { useRooms, useUnits, Room } from "@/hooks/useRooms";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function RoomsContent() {
  const { data: rooms = [], isLoading } = useRooms();
  const { data: units = [] } = useUnits();

  const [search, setSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const allRooms = useMemo(() => {
    // Flatten from units to get all rooms
    const flatRooms: (Room & { unitName: string })[] = [];
    for (const unit of units) {
      for (const room of unit.rooms || []) {
        flatRooms.push({ ...room, unitName: unit.unit });
      }
    }
    return flatRooms;
  }, [units]);

  const locations = useMemo(() => {
    const set = new Set(allRooms.map(r => r.location).filter(Boolean));
    return Array.from(set).sort();
  }, [allRooms]);

  const buildings = useMemo(() => {
    const source = selectedLocations.length
      ? allRooms.filter(r => selectedLocations.includes(r.location))
      : allRooms;
    const set = new Set(source.map(r => r.building).filter(Boolean));
    return Array.from(set).sort();
  }, [allRooms, selectedLocations]);

  const filtered = useMemo(() => {
    let list = allRooms.filter(r => r.room_type !== "Car Park");
    if (selectedLocations.length) list = list.filter(r => selectedLocations.includes(r.location));
    if (selectedBuildings.length) list = list.filter(r => selectedBuildings.includes(r.building));
    if (statusFilter !== "all") list = list.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.building.toLowerCase().includes(s) ||
        r.unit.toLowerCase().includes(s) ||
        r.room.toLowerCase().includes(s) ||
        r.location.toLowerCase().includes(s)
      );
    }
    return list;
  }, [allRooms, selectedLocations, selectedBuildings, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search rooms..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <MultiSelectFilter
          label="Location"
          placeholder="All Locations"
          options={locations}
          selected={selectedLocations}
          onApply={v => { setSelectedLocations(v); setPage(1); }}
        />
        <MultiSelectFilter
          label="Building"
          placeholder="All Buildings"
          options={buildings}
          selected={selectedBuildings}
          onApply={v => { setSelectedBuildings(v); setPage(1); }}
        />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="Available Soon">Available Soon</SelectItem>
            <SelectItem value="Reserved">Reserved</SelectItem>
            <SelectItem value="Tenanted">Tenanted</SelectItem>
            <SelectItem value="Occupied">Occupied</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} rooms</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Building</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Bed</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No rooms found
                </TableCell>
              </TableRow>
            ) : (
              paged.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.building}</TableCell>
                  <TableCell className="text-sm">{r.unit}</TableCell>
                  <TableCell className="text-sm font-medium">{r.room}</TableCell>
                  <TableCell className="text-sm">{r.room_type}</TableCell>
                  <TableCell className="text-sm">{r.bed_type || "—"}</TableCell>
                  <TableCell className="text-sm text-right font-medium">RM{r.rent}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.tenant_gender || r.tenant_race ? `${r.tenant_gender} ${r.tenant_race}`.trim() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

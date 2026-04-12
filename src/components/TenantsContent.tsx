import { useState, useMemo } from "react";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useRooms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";

export function TenantsContent() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: units = [] } = useUnits();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedTenant, setSelectedTenant] = useState<Booking | null>(null);

  const { sort, handleSort, sortData } = useTableSort("tenant_name");

  // Only show approved/active bookings as "tenants"
  const tenants = useMemo(() => {
    let list = bookings.filter(b => b.status === "approved");
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b =>
        b.tenant_name.toLowerCase().includes(s) ||
        b.tenant_phone.toLowerCase().includes(s) ||
        b.tenant_email?.toLowerCase().includes(s) ||
        (b.room?.building || "").toLowerCase().includes(s) ||
        (b.room?.unit || "").toLowerCase().includes(s) ||
        (b.room?.room || "").toLowerCase().includes(s)
      );
    }
    return sortData(list, (b: Booking, key: string) => {
      const map: Record<string, any> = {
        tenant_name: b.tenant_name,
        tenant_phone: b.tenant_phone,
        tenant_email: b.tenant_email || "",
        property: b.room?.building || "",
        room: b.room ? `${b.room.unit} · ${b.room.room}` : "",
        move_in_date: b.move_in_date,
        contract_months: b.contract_months,
      };
      return map[key];
    });
  }, [bookings, search, sort]);

  const totalPages = Math.max(1, Math.ceil(tenants.length / pageSize));
  const paged = tenants.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <span className="text-sm text-muted-foreground ml-auto">{tenants.length} active tenants</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="tenant_phone" currentSort={sort} onSort={handleSort}>Phone</SortableTableHead>
              <SortableTableHead sortKey="tenant_email" currentSort={sort} onSort={handleSort}>Email</SortableTableHead>
              <SortableTableHead sortKey="property" currentSort={sort} onSort={handleSort}>Property</SortableTableHead>
              <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
              <SortableTableHead sortKey="move_in_date" currentSort={sort} onSort={handleSort}>Move-in</SortableTableHead>
              <SortableTableHead sortKey="contract_months" currentSort={sort} onSort={handleSort}>Contract</SortableTableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No tenants found
                </TableCell>
              </TableRow>
            ) : (
              paged.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-medium">{b.tenant_name}</TableCell>
                  <TableCell className="text-sm">{b.tenant_phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.tenant_email || "—"}</TableCell>
                  <TableCell className="text-sm">{b.room?.building || "—"}</TableCell>
                  <TableCell className="text-sm">{b.room ? `${b.room.unit} · ${b.room.room}` : "—"}</TableCell>
                  <TableCell className="text-sm">{b.move_in_date}</TableCell>
                  <TableCell className="text-sm">{b.contract_months}m</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTenant(b)}>
                      <Eye className="h-4 w-4" />
                    </Button>
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

      {/* Tenant Detail Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tenant Details</DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <div className="text-lg font-semibold">{selectedTenant.tenant_name}</div>
                  {selectedTenant.room && (
                    <div className="text-sm text-muted-foreground">
                      {selectedTenant.room.building} · {selectedTenant.room.unit} · {selectedTenant.room.room}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Phone:</span> {selectedTenant.tenant_phone}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedTenant.tenant_email || "—"}</div>
                  <div><span className="text-muted-foreground">IC/Passport:</span> {selectedTenant.tenant_ic_passport || "—"}</div>
                  <div><span className="text-muted-foreground">Gender:</span> {selectedTenant.tenant_gender || "—"}</div>
                  <div><span className="text-muted-foreground">Race:</span> {selectedTenant.tenant_race || "—"}</div>
                  <div><span className="text-muted-foreground">Nationality:</span> {selectedTenant.tenant_nationality || "—"}</div>
                  <div><span className="text-muted-foreground">Move-in:</span> {selectedTenant.move_in_date}</div>
                  <div><span className="text-muted-foreground">Contract:</span> {selectedTenant.contract_months} months</div>
                  <div><span className="text-muted-foreground">Occupation:</span> {selectedTenant.occupation || "—"}</div>
                  <div><span className="text-muted-foreground">Pax:</span> {selectedTenant.pax_staying}</div>
                </div>
                <div className="border-t pt-3">
                  <div className="text-sm font-semibold text-muted-foreground mb-2">Emergency Contacts</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="font-medium">{selectedTenant.emergency_name || "—"}</div>
                      <div className="text-muted-foreground">{selectedTenant.emergency_phone || "—"}</div>
                      <div className="text-muted-foreground">{selectedTenant.emergency_relationship || "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium">{selectedTenant.emergency_contact_2 || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

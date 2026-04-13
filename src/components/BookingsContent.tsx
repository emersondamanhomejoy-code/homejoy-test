import { useState, useMemo, useEffect } from "react";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Pencil, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButtons } from "@/components/ui/action-buttons";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { BookingDetailView } from "@/components/BookingDetailView";
import { BookingEditView } from "@/components/BookingEditView";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { toast } from "sonner";

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export function BookingsContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allBookings = [], isLoading } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();
  const { data: roomsData = [] } = useRooms();

  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [roomFilter, setRoomFilter] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showCancelDialog, setShowCancelDialog] = useState<Booking | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Booking | null>(null);

  // Fetch users/agents
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [agents, setAgents] = useState<(UserInfo & { roles: string[] })[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map(p => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
    const fetchAgents = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, name");
      if (roles && profiles) {
        const agentUserIds = [...new Set(roles.filter(r => r.role === "agent").map(r => r.user_id))];
        const agentList = agentUserIds.map(uid => {
          const p = profiles.find(pr => pr.user_id === uid);
          const userRoles = roles.filter(r => r.user_id === uid).map(r => r.role);
          return { id: uid, email: p?.email || "", name: p?.name || "", roles: userRoles };
        });
        setAgents(agentList);
      }
    };
    fetchAgents();
  }, []);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "—";
    const u = users.find(u => u.id === agentId);
    return u?.name || u?.email || agentId.slice(0, 8);
  };

  const locationOptions = useMemo(() => [...new Set(roomsData.map(r => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map(r => r.building).filter(Boolean))].sort(), [roomsData]);
  const unitOptions = useMemo(() => [...new Set(roomsData.map(r => r.unit).filter(Boolean))].sort(), [roomsData]);
  const roomOptions = useMemo(() => [...new Set(roomsData.map(r => r.room).filter(Boolean))].sort(), [roomsData]);
  const agentOptions = useMemo(() => agents.map(a => a.name || a.email).filter(Boolean).sort(), [agents]);

  const getRoomInfo = (booking: Booking) => {
    if (booking.room) return booking.room;
    const r = roomsData.find(rm => rm.id === booking.room_id);
    return r ? { room: r.room, building: r.building, unit: r.unit } : null;
  };

  const filtered = useMemo(() => {
    let list = allBookings;
    if (statusFilter && statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b => b.tenant_name.toLowerCase().includes(s) || b.id.toLowerCase().includes(s) || (b.room?.building || "").toLowerCase().includes(s));
    }
    if (locationFilter.length > 0) list = list.filter(b => { const r = roomsData.find(rm => rm.id === b.room_id); return r && locationFilter.includes(r.location); });
    if (buildingFilter.length > 0) list = list.filter(b => { const info = getRoomInfo(b); return info && buildingFilter.includes(info.building); });
    if (unitFilter.length > 0) list = list.filter(b => { const info = getRoomInfo(b); return info && unitFilter.includes(info.unit); });
    if (roomFilter.length > 0) list = list.filter(b => { const info = getRoomInfo(b); return info && roomFilter.includes(info.room); });
    if (agentFilter.length > 0) list = list.filter(b => { const name = getAgentName(b.submitted_by); return agentFilter.includes(name); });
    if (dateFrom) list = list.filter(b => b.created_at >= dateFrom);
    if (dateTo) list = list.filter(b => b.created_at <= dateTo + "T23:59:59");
    return sortData(list, (b: Booking, key: string) => {
      const info = getRoomInfo(b);
      const map: Record<string, any> = { id: b.id, building: info?.building || "", unit: info?.unit || "", room: info?.room || "", tenant_name: b.tenant_name, monthly_salary: b.monthly_salary, agent: getAgentName(b.submitted_by), created_at: b.created_at, status: b.status };
      return map[key];
    });
  }, [allBookings, statusFilter, search, sort, locationFilter, buildingFilter, unitFilter, roomFilter, agentFilter, dateFrom, dateTo, roomsData, agents, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const statusBadge = (status: string) => {
    const cls = status === "pending" ? "bg-yellow-500/20 text-yellow-600" : status === "approved" ? "bg-green-500/20 text-green-600" : status === "cancelled" ? "bg-gray-500/20 text-gray-500" : "bg-red-500/20 text-red-600";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status.toUpperCase()}</span>;
  };

  const handleCancel = async (reason?: string) => {
    if (!user || !showCancelDialog || !reason?.trim()) { toast.error("Cancel reason is required"); return; }
    const b = showCancelDialog;
    await updateBookingStatus.mutateAsync({ id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: reason });
    if (b.room_id) {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    }
    toast.success("Booking cancelled");
    setShowCancelDialog(null);
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    const b = showDeleteDialog;
    if (b.room_id && b.status === "pending") {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
    }
    await supabase.from("bookings").delete().eq("id", b.id);
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    toast.success("Booking deleted");
    setShowDeleteDialog(null);
  };

  const hasActiveFilters = locationFilter.length > 0 || buildingFilter.length > 0 || unitFilter.length > 0 || roomFilter.length > 0 || agentFilter.length > 0 || dateFrom || dateTo;
  const clearAllFilters = () => { setLocationFilter([]); setBuildingFilter([]); setUnitFilter([]); setRoomFilter([]); setAgentFilter([]); setDateFrom(""); setDateTo(""); };

  return (
    <StandardPageLayout title="Bookings" actionLabel="Create Booking" actionIcon={Plus} onAction={() => setShowCreateDialog(true)}>
      {/* Create Booking Dialog */}
      <CreateBookingDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {/* View Booking Dialog */}
      {viewBooking && (
        <BookingDetailView
          booking={allBookings.find(bk => bk.id === viewBooking.id) || viewBooking}
          open={!!viewBooking}
          onOpenChange={(open) => { if (!open) setViewBooking(null); }}
          getAgentName={getAgentName}
        />
      )}

      {editBooking && (
        <BookingEditView
          booking={allBookings.find(bk => bk.id === editBooking.id) || editBooking}
          open={!!editBooking}
          onOpenChange={(open) => { if (!open) setEditBooking(null); }}
        />
      )}

      {/* Cancel Booking Dialog */}
      <ConfirmDialog
        open={!!showCancelDialog}
        onOpenChange={(open) => { if (!open) setShowCancelDialog(null); }}
        title="Cancel Booking?"
        description="⚠️ Booking fee is non-refundable once paid. Please confirm with the tenant before cancelling."
        confirmLabel="Cancel Booking"
        variant="destructive"
        onConfirm={handleCancel}
        reasonRequired
        reasonPlaceholder="Cancel reason (required)..."
      />

      {/* Delete Booking Dialog */}
      <ConfirmDialog
        open={!!showDeleteDialog}
        onOpenChange={(open) => { if (!open) setShowDeleteDialog(null); }}
        title="Delete Booking?"
        description="This action cannot be undone. The booking record will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Search + Status filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search name, ID, building..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground"><X className="h-3 w-3 mr-1" /> Clear Filters</Button>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={v => { setLocationFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={v => { setBuildingFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Unit" placeholder="All" options={unitOptions} selected={unitFilter} onApply={v => { setUnitFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Room" placeholder="All" options={roomOptions} selected={roomFilter} onApply={v => { setRoomFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={v => { setAgentFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date To</label>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading bookings...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Booking ID</SortableTableHead>
                <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
                <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
                <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant Name</SortableTableHead>
                <SortableTableHead sortKey="monthly_salary" currentSort={sort} onSort={handleSort}>Final Rental</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted At</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-muted-foreground py-8">No bookings found</TableCell></TableRow>
              ) : (
                paged.map(b => {
                  const info = getRoomInfo(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs text-center">{b.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-center">{info?.building || "—"}</TableCell>
                      <TableCell className="text-center">{info?.unit || "—"}</TableCell>
                      <TableCell className="text-center">{info?.room || "—"}</TableCell>
                      <TableCell className="font-medium text-center">{b.tenant_name}</TableCell>
                      <TableCell className="text-center">RM{b.monthly_salary || 0}</TableCell>
                      <TableCell className="text-center">{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-sm text-center">{getAgentName(b.submitted_by)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">{format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <ActionButtons actions={[
                            { type: "view", onClick: () => setViewBooking(b) },
                            { type: "edit", onClick: () => setEditBooking(b), show: b.status === "pending" || b.status === "rejected" },
                            { type: "cancel", onClick: () => setShowCancelDialog(b), show: b.status === "pending" || b.status === "approved" },
                            { type: "delete", onClick: () => setShowDeleteDialog(b), show: b.status !== "pending" && b.status !== "approved" },
                          ]} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </StandardPageLayout>
  );
}

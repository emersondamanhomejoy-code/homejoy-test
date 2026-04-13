import { useState, useMemo, useEffect } from "react";
import { useBookings, useUpdateBookingStatus, Booking, BOOKING_TYPE_LABELS, BookingType } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StandardPageLayout } from "@/components/ui/standard-page-layout";
import { StandardFilterBar } from "@/components/ui/standard-filter-bar";
import { StandardTable } from "@/components/ui/standard-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButtons } from "@/components/ui/action-buttons";
import { BookingDetailView } from "@/components/BookingDetailView";
import { BookingEditView } from "@/components/BookingEditView";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { labelClass } from "@/lib/ui-constants";
import { toast } from "sonner";

const STATUS_TABS = ["all", "submitted", "approved", "rejected", "cancelled"] as const;

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
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
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
  const agentOptions = useMemo(() => agents.map(a => a.name || a.email).filter(Boolean).sort(), [agents]);

  const getRoomInfo = (booking: Booking) => {
    if (booking.room) return booking.room;
    const r = roomsData.find(rm => rm.id === booking.room_id);
    return r ? { room: r.room, building: r.building, unit: r.unit } : null;
  };

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allBookings.length };
    for (const b of allBookings) counts[b.status] = (counts[b.status] || 0) + 1;
    return counts;
  }, [allBookings]);

  const filtered = useMemo(() => {
    let list = allBookings;
    if (statusTab !== "all") list = list.filter(b => b.status === statusTab);
    if (bookingTypeFilter !== "all") list = list.filter(b => (b.booking_type || "room_only") === bookingTypeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b => b.tenant_name.toLowerCase().includes(s) || (b.room?.building || "").toLowerCase().includes(s) || (b.room?.unit || "").toLowerCase().includes(s) || (b.room?.room || "").toLowerCase().includes(s));
    }
    if (locationFilter.length > 0) list = list.filter(b => { const r = roomsData.find(rm => rm.id === b.room_id); return r && locationFilter.includes(r.location); });
    if (buildingFilter.length > 0) list = list.filter(b => { const info = getRoomInfo(b); return info && buildingFilter.includes(info.building); });
    if (agentFilter.length > 0) list = list.filter(b => { const name = getAgentName(b.submitted_by); return agentFilter.includes(name); });
    if (dateFrom) list = list.filter(b => b.created_at >= dateFrom);
    if (dateTo) list = list.filter(b => b.created_at <= dateTo + "T23:59:59");
    return sortData(list, (b: Booking, key: string) => {
      const info = getRoomInfo(b);
      const map: Record<string, any> = { building: info?.building || "", unit: info?.unit || "", room: info?.room || "", booking_type: b.booking_type || "room_only", tenant_name: b.tenant_name, monthly_salary: b.monthly_salary, agent: getAgentName(b.submitted_by), created_at: b.created_at, updated_at: b.updated_at, status: b.status };
      return map[key];
    });
  }, [allBookings, statusTab, bookingTypeFilter, search, sort, locationFilter, buildingFilter, agentFilter, dateFrom, dateTo, roomsData, agents, users]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasActiveFilters = locationFilter.length > 0 || buildingFilter.length > 0 || agentFilter.length > 0 || dateFrom !== "" || dateTo !== "" || bookingTypeFilter !== "all";
  const clearAllFilters = () => { setLocationFilter([]); setBuildingFilter([]); setAgentFilter([]); setDateFrom(""); setDateTo(""); setStatusTab("all"); setBookingTypeFilter("all"); setSearch(""); setPage(0); };

  const bookingTypeBadge = (type: string) => {
    const label = BOOKING_TYPE_LABELS[type as BookingType] || type;
    const cls = type === "carpark_only" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : type === "room_carpark" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "bg-muted text-muted-foreground";
    return <Badge variant="secondary" className={`font-medium border-0 text-xs ${cls}`}>{label}</Badge>;
  };

  const handleCancel = async (reason?: string) => {
    if (!user || !showCancelDialog || !reason?.trim()) { toast.error("Cancel reason is required"); return; }
    const b = showCancelDialog;
    const carParkIds = ((b.documents as any)?.carParkSelections || []).map((s: any) => s.roomId).filter(Boolean);
    const history = [...(b.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason }];
    await updateBookingStatus.mutateAsync({
      id: b.id, status: "cancelled", reviewed_by: user.id, reject_reason: reason,
      room_id: b.room_id, carParkIds, history,
      resolution_type: b.status === "approved" ? "forfeit" : "",
    });
    toast.success("Booking cancelled");
    setShowCancelDialog(null);
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    const b = showDeleteDialog;
    if (b.room_id && b.status === "submitted") {
      await supabase.from("rooms").update({ status: "Available" }).eq("id", b.room_id);
    }
    await supabase.from("bookings").delete().eq("id", b.id);
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    toast.success("Booking deleted");
    setShowDeleteDialog(null);
  };

  return (
    <StandardPageLayout title="Bookings" actionLabel="Create Booking" actionIcon={<Plus className="h-4 w-4" />} onAction={() => setShowCreateDialog(true)}>
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
        description={showCancelDialog?.status === "approved"
          ? "⚠️ This is an approved booking. Cancelling will mark it as Forfeit and release all pending room/carpark holds."
          : "⚠️ Booking fee is non-refundable once paid. Please confirm with the tenant before cancelling."}
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

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-3">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => { setStatusTab(s); setPage(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusTab === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1 opacity-70">({statusCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <StandardFilterBar
        search={search}
        onSearchChange={v => { setSearch(v); setPage(0); }}
        placeholder="Search tenant, building, unit, room..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
      >
        <div className="space-y-1.5">
          <label className={labelClass}>Booking Type</label>
          <Select value={bookingTypeFilter} onValueChange={v => { setBookingTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="room_only">Room Only</SelectItem>
              <SelectItem value="room_carpark">Room + Carpark</SelectItem>
              <SelectItem value="carpark_only">Carpark Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={v => { setAgentFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={v => { setLocationFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={v => { setBuildingFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className={labelClass}>Date From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10 w-[150px]" />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Date To</label>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10 w-[150px]" />
        </div>
      </StandardFilterBar>

      {/* Table */}
      <StandardTable
        columns={
          <TableRow className="bg-muted/30">
            <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
            <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
            <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
            <SortableTableHead sortKey="booking_type" currentSort={sort} onSort={handleSort}>Booking Type</SortableTableHead>
            <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant Name</SortableTableHead>
            <SortableTableHead sortKey="monthly_salary" currentSort={sort} onSort={handleSort}>Exact Rental</SortableTableHead>
            <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
            <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
            <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted At</SortableTableHead>
            <SortableTableHead sortKey="updated_at" currentSort={sort} onSort={handleSort}>Last Updated</SortableTableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        }
        isEmpty={filtered.length === 0}
        emptyMessage="No bookings found."
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        showCount
        countLabel="booking(s)"
      >
        {paged.map(b => {
          const info = getRoomInfo(b);
          const bType = (b.booking_type || "room_only") as BookingType;
          return (
            <TableRow key={b.id}>
              <TableCell className="text-center">{info?.building || "—"}</TableCell>
              <TableCell className="text-center">{info?.unit || "—"}</TableCell>
              <TableCell className="text-center">{info?.room || "—"}</TableCell>
              <TableCell className="text-center">{bookingTypeBadge(bType)}</TableCell>
              <TableCell className="font-medium text-center">{b.tenant_name}</TableCell>
              <TableCell className="text-center">RM{(b.move_in_cost as any)?.advance || b.monthly_salary || 0}</TableCell>
              <TableCell className="text-center"><StatusBadge status={b.status.charAt(0).toUpperCase() + b.status.slice(1)} /></TableCell>
              <TableCell className="text-sm text-center">{getAgentName(b.submitted_by)}</TableCell>
              <TableCell className="text-sm text-muted-foreground text-center">{format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
              <TableCell className="text-sm text-muted-foreground text-center">{format(new Date(b.updated_at), "dd MMM yyyy, HH:mm")}</TableCell>
              <TableCell>
                <div className="flex gap-1 justify-center">
                  <ActionButtons actions={[
                    { type: "view", onClick: () => setViewBooking(b) },
                    { type: "edit", onClick: () => setEditBooking(b), show: b.status === "submitted" || b.status === "rejected" },
                    { type: "cancel", onClick: () => setShowCancelDialog(b), show: b.status === "submitted" || b.status === "approved" },
                    { type: "delete", onClick: () => setShowDeleteDialog(b), show: b.status !== "submitted" && b.status !== "approved" },
                  ]} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </StandardTable>
    </StandardPageLayout>
  );
}

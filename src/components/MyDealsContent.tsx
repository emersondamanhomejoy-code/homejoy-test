import { useState, useMemo, useEffect } from "react";
import { useMoveIns, MoveIn } from "@/hooks/useMoveIns";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

interface CommissionConfig {
  percentage?: number;
  tiers?: { min: number; max: number | null; amount?: number; percentage?: number }[];
}

export function MyDealsContent() {
  const { user } = useAuth();
  const { data: moveIns = [] } = useMoveIns();
  const { data: allBookings = [] } = useBookings();

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const { sort, handleSort, sortData } = useTableSort("approved_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [commissionType, setCommissionType] = useState("internal_basic");
  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("commission_type, commission_config").eq("user_id", user.id).eq("role", "agent").single()
      .then(({ data }) => {
        if (data?.commission_type) setCommissionType(data.commission_type);
        if (data?.commission_config) setCommissionConfig(data.commission_config as CommissionConfig);
      });
  }, [user]);

  // My completed deals = approved move-ins submitted by my bookings
  const myDeals = useMemo(() => {
    if (!user) return [];
    const myBookingIds = new Set(allBookings.filter(b => b.submitted_by === user.id).map(b => b.id));
    return moveIns.filter(m => m.status === "approved" && m.booking_id && myBookingIds.has(m.booking_id));
  }, [moveIns, allBookings, user]);

  const calculateCommission = (moveIn: MoveIn): number => {
    const booking = allBookings.find(b => b.id === moveIn.booking_id);
    if (!booking) return 0;
    const rent = booking.monthly_salary || 0;
    const duration = booking.contract_months || 12;
    const durationMultiplier = duration / 12;

    // Count monthly deals for tier calculation
    const approvedAt = moveIn.reviewed_at ? new Date(moveIn.reviewed_at) : new Date(moveIn.updated_at);
    const monthStart = new Date(approvedAt.getFullYear(), approvedAt.getMonth(), 1);
    const monthEnd = new Date(approvedAt.getFullYear(), approvedAt.getMonth() + 1, 0, 23, 59, 59);
    const monthlyDeals = myDeals.filter(d => {
      const dAt = d.reviewed_at ? new Date(d.reviewed_at) : new Date(d.updated_at);
      return dAt >= monthStart && dAt <= monthEnd;
    }).length;

    const config = commissionConfig;
    let base = 0;
    if (commissionType === "external") {
      const pct = config?.percentage ?? 100;
      base = Math.round(rent * pct / 100);
    } else if (commissionType === "internal_full") {
      const tiers = config?.tiers || [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }];
      const tier = tiers.find(t => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      const pct = tier?.percentage ?? 70;
      base = Math.round(rent * pct / 100);
    } else {
      const tiers = config?.tiers || [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }];
      const tier = tiers.find(t => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      base = tier?.amount ?? 200;
    }
    return Math.round(base * durationMultiplier);
  };

  const filtered = useMemo(() => {
    let list = myDeals;
    if (monthFilter !== "all") {
      const [y, m] = monthFilter.split("-").map(Number);
      list = list.filter(d => {
        const at = d.reviewed_at ? new Date(d.reviewed_at) : new Date(d.updated_at);
        return at.getFullYear() === y && at.getMonth() === m;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(d =>
        d.tenant_name.toLowerCase().includes(s) ||
        (d.room?.building || "").toLowerCase().includes(s) ||
        d.id.toLowerCase().includes(s)
      );
    }
    return sortData(list, (d: MoveIn, key: string) => {
      const map: Record<string, any> = {
        id: d.id,
        tenant_name: d.tenant_name,
        building: d.room?.building || "",
        unit: d.room?.unit || "",
        room: d.room?.room || "",
        approved_at: d.reviewed_at || d.updated_at,
      };
      return map[key] || "";
    });
  }, [myDeals, monthFilter, search, sort]);

  const totalCommission = useMemo(() => {
    return filtered.reduce((sum, d) => sum + calculateCommission(d), 0);
  }, [filtered, commissionType, commissionConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Generate month options
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    myDeals.forEach(d => {
      const at = d.reviewed_at ? new Date(d.reviewed_at) : new Date(d.updated_at);
      months.add(`${at.getFullYear()}-${at.getMonth()}`);
    });
    return Array.from(months).sort().reverse().map(m => {
      const [y, mo] = m.split("-").map(Number);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { value: m, label: `${monthNames[mo]} ${y}` };
    });
  }, [myDeals]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold">My Deals</h2>
        <p className="text-sm text-muted-foreground mt-1">Completed deals where move-in has been approved.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Deals" value={filtered.length} valueColor="text-emerald-600" />
        <StatCard label="Total Commission" value={`RM ${totalCommission.toLocaleString()}`} valueColor="text-emerald-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={monthFilter} onValueChange={v => { setMonthFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Search tenant, condo, ID..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Deal ID</SortableTableHead>
              <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
              <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
              <SortableTableHead sortKey="unit" currentSort={sort} onSort={handleSort}>Unit</SortableTableHead>
              <SortableTableHead sortKey="room" currentSort={sort} onSort={handleSort}>Room</SortableTableHead>
              <TableHead className="text-right">Rental</TableHead>
              <SortableTableHead sortKey="approved_at" currentSort={sort} onSort={handleSort}>Approved</SortableTableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No completed deals yet
                </TableCell>
              </TableRow>
            ) : (
              paged.map(d => {
                const booking = allBookings.find(b => b.id === d.booking_id);
                const commission = calculateCommission(d);
                const approvedAt = d.reviewed_at || d.updated_at;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{d.tenant_name}</TableCell>
                    <TableCell>{d.room?.building || "—"}</TableCell>
                    <TableCell>{d.room?.unit || "—"}</TableCell>
                    <TableCell>{d.room?.room || "—"}</TableCell>
                    <TableCell className="text-right">RM{booking?.monthly_salary?.toLocaleString() || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(approvedAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">RM{commission.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

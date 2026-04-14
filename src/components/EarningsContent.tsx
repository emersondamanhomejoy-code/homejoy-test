import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Earning {
  id: string;
  agent_id: string;
  booking_id: string | null;
  move_in_id: string | null;
  room_id: string | null;
  tenant_name: string;
  building: string;
  unit: string;
  room: string;
  exact_rental: number;
  commission_type: string;
  commission_amount: number;
  status: string;
  pay_cycle: string;
  payout_id: string | null;
  created_at: string;
  updated_at: string;
}

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  internal_basic: "Internal Basic",
  internal_full: "Internal Full",
  external: "External",
};

export function EarningsContent() {
  const { user } = useAuth();

  const { data: earnings = [], isLoading } = useQuery({
    queryKey: ["earnings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earnings")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Earning[];
    },
    enabled: !!user,
  });

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [commTypeFilter, setCommTypeFilter] = useState<string[]>([]);
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    earnings.forEach(e => {
      if (e.pay_cycle) months.add(e.pay_cycle);
      else {
        const d = new Date(e.created_at);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    });
    return Array.from(months).sort().reverse();
  }, [earnings]);

  const buildingOptions = useMemo(() => [...new Set(earnings.map(e => e.building).filter(Boolean))].sort(), [earnings]);

  const filtered = useMemo(() => {
    let list = earnings;
    if (monthFilter !== "all") {
      list = list.filter(e => {
        const cycle = e.pay_cycle || `${new Date(e.created_at).getFullYear()}-${String(new Date(e.created_at).getMonth() + 1).padStart(2, "0")}`;
        return cycle === monthFilter;
      });
    }
    if (statusFilter.length) list = list.filter(e => statusFilter.includes(e.status));
    if (buildingFilter.length) list = list.filter(e => buildingFilter.includes(e.building));
    if (commTypeFilter.length) list = list.filter(e => commTypeFilter.includes(e.commission_type));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(e =>
        e.tenant_name.toLowerCase().includes(s) ||
        e.building.toLowerCase().includes(s) ||
        e.unit.toLowerCase().includes(s) ||
        e.room.toLowerCase().includes(s)
      );
    }
    return sortData(list, (e: Earning, key: string) => {
      const m: Record<string, any> = {
        tenant_name: e.tenant_name,
        building: e.building,
        unit: e.unit,
        room: e.room,
        exact_rental: e.exact_rental,
        commission_type: e.commission_type,
        commission_amount: e.commission_amount,
        status: e.status,
        pay_cycle: e.pay_cycle,
        created_at: e.created_at,
      };
      return m[key] ?? "";
    });
  }, [earnings, monthFilter, statusFilter, buildingFilter, commTypeFilter, search, sort]);

  const totalAmount = useMemo(() => filtered.reduce((s, e) => s + e.commission_amount, 0), [filtered]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasFilters = statusFilter.length > 0 || buildingFilter.length > 0 || commTypeFilter.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Earnings</h2>
        <p className="text-sm text-muted-foreground mt-1">Commission records from your completed deals.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Records</div>
          <div className="text-3xl font-bold text-foreground">{filtered.length}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900 p-5">
          <div className="text-xs font-semibold text-emerald-600 mb-1">Total Commission</div>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">RM {totalAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search tenant, building, unit..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={monthFilter} onValueChange={v => { setMonthFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <MultiSelectFilter label="Status" placeholder="All" options={["pending", "approved", "paid"]} selected={statusFilter} onApply={v => { setStatusFilter(v); setPage(0); }} />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-3 items-center">
          <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={v => { setBuildingFilter(v); setPage(0); }} />
          <MultiSelectFilter label="Commission Type" placeholder="All" options={Object.keys(COMMISSION_TYPE_LABELS)} selected={commTypeFilter} onApply={v => { setCommTypeFilter(v); setPage(0); }} />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="tenant_name" currentSort={sort} onSort={handleSort}>Tenant</SortableTableHead>
                <SortableTableHead sortKey="building" currentSort={sort} onSort={handleSort}>Building</SortableTableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Room</TableHead>
                <SortableTableHead sortKey="exact_rental" currentSort={sort} onSort={handleSort}>Rental</SortableTableHead>
                <SortableTableHead sortKey="commission_type" currentSort={sort} onSort={handleSort}>Type</SortableTableHead>
                <SortableTableHead sortKey="commission_amount" currentSort={sort} onSort={handleSort}>Commission</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="pay_cycle" currentSort={sort} onSort={handleSort}>Pay Cycle</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No earnings records yet</TableCell></TableRow>
              ) : paged.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.tenant_name}</TableCell>
                  <TableCell>{e.building}</TableCell>
                  <TableCell>{e.unit}</TableCell>
                  <TableCell>{e.room}</TableCell>
                  <TableCell>RM {e.exact_rental.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{COMMISSION_TYPE_LABELS[e.commission_type] || e.commission_type}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">RM {e.commission_amount.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.pay_cycle || "—"}</TableCell>
                </TableRow>
              ))}
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
    </div>
  );
}

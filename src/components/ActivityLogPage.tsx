import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Eye, ChevronLeft, ChevronRight, X } from "lucide-react";

interface ActivityLog {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address: string;
  created_at: string;
}

const MODULE_OPTIONS = ["booking", "move_in", "claim", "user", "unit", "room", "building", "location"];
const ACTION_OPTIONS = ["create", "edit", "approve", "reject", "cancel", "delete", "undo"];

export function ActivityLogPage() {
  const { role } = useAuth();
  const canView = role === "boss" || role === "manager";

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [viewLog, setViewLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    if (!canView) return;
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) setLogs(data as unknown as ActivityLog[]);
      setLoading(false);
    };
    fetch();
  }, [canView]);

  const filtered = useMemo(() => {
    let list = logs;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(l => l.actor_email.toLowerCase().includes(s) || l.action.toLowerCase().includes(s) || l.entity_id.toLowerCase().includes(s) || JSON.stringify(l.details).toLowerCase().includes(s));
    }
    if (moduleFilter.length) list = list.filter(l => moduleFilter.includes(l.entity_type));
    if (actionFilter.length) list = list.filter(l => actionFilter.some(a => l.action.includes(a)));
    if (dateFrom) list = list.filter(l => l.created_at >= dateFrom);
    if (dateTo) list = list.filter(l => l.created_at <= dateTo + "T23:59:59");
    return sortData(list, (l: ActivityLog, key: string) => {
      const map: Record<string, any> = { created_at: l.created_at, actor_email: l.actor_email, action: l.action, entity_type: l.entity_type, entity_id: l.entity_id };
      return map[key];
    });
  }, [logs, search, moduleFilter, actionFilter, dateFrom, dateTo, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasActiveFilters = moduleFilter.length > 0 || actionFilter.length > 0 || dateFrom || dateTo;
  const clearFilters = () => { setModuleFilter([]); setActionFilter([]); setDateFrom(""); setDateTo(""); };

  const detailSummary = (log: ActivityLog) => {
    const d = log.details;
    if (!d || typeof d !== "object") return "";
    const parts: string[] = [];
    if (d.tenant_name) parts.push(d.tenant_name);
    if (d.email) parts.push(d.email);
    if (d.building) parts.push(d.building);
    if (d.unit) parts.push(d.unit);
    if (d.reason) parts.push(`Reason: ${d.reason}`);
    return parts.join(" · ");
  };

  if (!canView) return <div className="text-center py-10 text-muted-foreground">Access denied. Manager or Boss role required.</div>;

  return (
    <div className="space-y-4">
      {/* View Log Modal */}
      {viewLog && (
        <Dialog open={!!viewLog} onOpenChange={(open) => { if (!open) setViewLog(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Activity Detail</DialogTitle></DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-80px)]">
              <div className="space-y-4 py-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date/Time</span><span className="font-medium">{format(new Date(viewLog.created_at), "dd MMM yyyy, HH:mm:ss")}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">User</span><span className="font-medium">{viewLog.actor_email}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Action</span><span className="font-medium">{viewLog.action}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Module</span><span className="font-medium capitalize">{viewLog.entity_type}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Target ID</span><span className="font-mono text-xs">{viewLog.entity_id || "—"}</span></div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-bold mb-2">Details</div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(viewLog.details, null, 2)}</pre>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Activity Log</h2>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search user, action, ID..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="h-3 w-3 mr-1" /> Clear</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MultiSelectFilter label="Module" placeholder="All" options={MODULE_OPTIONS} selected={moduleFilter} onApply={v => { setModuleFilter(v); setPage(0); }} />
        <MultiSelectFilter label="Action" placeholder="All" options={ACTION_OPTIONS} selected={actionFilter} onApply={v => { setActionFilter(v); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date From</label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date To</label>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Date/Time</SortableTableHead>
                <SortableTableHead sortKey="actor_email" currentSort={sort} onSort={handleSort}>User</SortableTableHead>
                <SortableTableHead sortKey="entity_type" currentSort={sort} onSort={handleSort}>Module</SortableTableHead>
                <SortableTableHead sortKey="action" currentSort={sort} onSort={handleSort}>Action</SortableTableHead>
                <SortableTableHead sortKey="entity_id" currentSort={sort} onSort={handleSort}>Target ID</SortableTableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground py-8 text-center">No logs found</TableCell></TableRow>
              ) : paged.map(l => (
                <TableRow key={l.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewLog(l)}>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(l.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell className="text-sm">{l.actor_email}</TableCell>
                  <TableCell className="text-sm capitalize">{l.entity_type}</TableCell>
                  <TableCell className="text-sm">{l.action}</TableCell>
                  <TableCell className="font-mono text-xs">{l.entity_id ? l.entity_id.slice(0, 8) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{detailSummary(l)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewLog(l); }}><Eye className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
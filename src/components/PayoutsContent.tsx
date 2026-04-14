import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronLeft, ChevronRight, FileText, Eye, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Earning {
  id: string;
  agent_id: string;
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
}

interface ProfileInfo { user_id: string; name: string; email: string; }

interface AgentRow {
  agent_id: string;
  agent_name: string;
  email: string;
  total_deals: number;
  total_earnings: number;
}

export function PayoutsContent() {
  const { user } = useAuth();

  const { data: allEarnings = [], isLoading } = useQuery({
    queryKey: ["all-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("earnings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Earning[];
    },
  });

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, name, email").then(({ data }) => {
      if (data) setProfiles(data.map(p => ({ user_id: p.user_id || "", name: p.name, email: p.email })));
    });
    supabase.from("user_roles").select("user_id").eq("role", "agent").then(({ data }) => {
      if (data) setAgentIds(data.map(r => r.user_id));
    });
  }, []);

  const getAgentName = (id: string) => {
    const p = profiles.find(pr => pr.user_id === id);
    return p?.name || p?.email || id.slice(0, 8);
  };
  const getAgentEmail = (id: string) => {
    const p = profiles.find(pr => pr.user_id === id);
    return p?.email || "";
  };

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { sort, handleSort, sortData } = useTableSort("total_deals", "desc");

  // Agent rows
  const agentRows = useMemo<AgentRow[]>(() => {
    const rows: AgentRow[] = agentIds.map(agentId => {
      const agentEarnings = allEarnings.filter(e => e.agent_id === agentId);
      return {
        agent_id: agentId,
        agent_name: getAgentName(agentId),
        email: getAgentEmail(agentId),
        total_deals: agentEarnings.length,
        total_earnings: agentEarnings.reduce((s, e) => s + e.commission_amount, 0),
      };
    });

    let filtered = rows;
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r => r.agent_name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
    }

    return sortData(filtered, (row: AgentRow, key: string) => {
      const m: Record<string, any> = {
        agent_name: row.agent_name,
        total_deals: row.total_deals,
        total_earnings: row.total_earnings,
      };
      return m[key] ?? "";
    });
  }, [agentIds, allEarnings, profiles, search, sort]);

  const totalPages = Math.max(1, Math.ceil(agentRows.length / pageSize));
  const paged = agentRows.slice(page * pageSize, (page + 1) * pageSize);

  // View agent detail
  const [viewAgent, setViewAgent] = useState<AgentRow | null>(null);
  const agentEarningsDetail = useMemo(() => {
    if (!viewAgent) return [];
    return allEarnings.filter(e => e.agent_id === viewAgent.agent_id);
  }, [viewAgent, allEarnings]);

  // Generate Report dialog
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportAgentId, setReportAgentId] = useState("");
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const reportEarnings = useMemo(() => {
    if (!reportAgentId || !reportMonth) return [];
    return allEarnings.filter(e => {
      if (e.agent_id !== reportAgentId) return false;
      const cycle = e.pay_cycle || `${new Date(e.created_at).getFullYear()}-${String(new Date(e.created_at).getMonth() + 1).padStart(2, "0")}`;
      return cycle === reportMonth;
    });
  }, [allEarnings, reportAgentId, reportMonth]);

  const reportTotal = useMemo(() => reportEarnings.reduce((s, e) => s + e.commission_amount, 0), [reportEarnings]);

  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrintReport = () => {
    if (!reportRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print the report");
      return;
    }
    const agentName = getAgentName(reportAgentId);
    const html = `
      <!DOCTYPE html>
      <html><head><title>Payment Report - ${agentName} - ${reportMonth}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
        .summary { display: flex; gap: 24px; margin-bottom: 24px; }
        .summary-card { background: #f5f5f5; padding: 16px; border-radius: 8px; flex: 1; }
        .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
        .summary-card .value { font-size: 24px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; color: #666; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .amount { text-align: right; font-weight: 600; }
        .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 16px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
        <h1>HOMEJOY — Payment Report</h1>
        <div class="subtitle">Agent: <strong>${agentName}</strong> · Period: <strong>${reportMonth}</strong> · Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}</div>
        
        <div class="summary">
          <div class="summary-card"><div class="label">Total Deals</div><div class="value">${reportEarnings.length}</div></div>
          <div class="summary-card"><div class="label">Total Commission</div><div class="value">RM ${reportTotal.toLocaleString()}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tenant</th>
              <th>Building</th>
              <th>Unit</th>
              <th>Room</th>
              <th>Rental</th>
              <th>Type</th>
              <th class="amount">Commission</th>
            </tr>
          </thead>
          <tbody>
            ${reportEarnings.map((e, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${e.tenant_name}</td>
                <td>${e.building}</td>
                <td>${e.unit}</td>
                <td>${e.room}</td>
                <td>RM ${e.exact_rental.toLocaleString()}</td>
                <td>${e.commission_type}</td>
                <td class="amount">RM ${e.commission_amount.toLocaleString()}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="7">Total</td>
              <td class="amount">RM ${reportTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          This is a system-generated payment record from HOMEJOY Agent Portal.
        </div>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="space-y-4">
      {/* View Agent Detail */}
      {viewAgent && (
        <Dialog open={Boolean(viewAgent)} onOpenChange={open => !open && setViewAgent(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>Agent Summary — {viewAgent.agent_name}</DialogTitle>
              <DialogDescription>{viewAgent.email}</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-bold">{viewAgent.total_deals}</div>
                  <div className="text-xs text-muted-foreground">Total Deals</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">RM {viewAgent.total_earnings.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Earnings</div>
                </div>
              </div>

              {agentEarningsDetail.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Earnings ({agentEarningsDetail.length})</h3>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Building</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Rental</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead>Pay Cycle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentEarningsDetail.map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.tenant_name}</TableCell>
                            <TableCell>{e.building}</TableCell>
                            <TableCell>{e.room}</TableCell>
                            <TableCell>RM {e.exact_rental.toLocaleString()}</TableCell>
                            <TableCell className="text-sm">{e.commission_type}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">RM {e.commission_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.pay_cycle}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="px-6 pb-6">
              <Button variant="outline" onClick={() => setViewAgent(null)}>Close</Button>
              <Button onClick={() => {
                setReportAgentId(viewAgent.agent_id);
                setViewAgent(null);
                setShowReportDialog(true);
              }}>
                <FileText className="h-4 w-4 mr-1" /> Generate Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Generate Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Generate Payment Report</DialogTitle>
            <DialogDescription>Select agent and month to generate a printable payment breakdown.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4 overflow-auto max-h-[calc(90vh-80px)]">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent</label>
                <Select value={reportAgentId || "none"} onValueChange={v => v !== "none" && setReportAgentId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select agent</SelectItem>
                    {agentIds.map(id => (
                      <SelectItem key={id} value={id}>{getAgentName(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Month (YYYY-MM)</label>
                <Input value={reportMonth} onChange={e => setReportMonth(e.target.value)} placeholder="2026-04" />
              </div>
            </div>

            {reportAgentId && (
              <div ref={reportRef} className="rounded-lg border p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg">{getAgentName(reportAgentId)}</div>
                    <div className="text-sm text-muted-foreground">{reportMonth}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Commission</div>
                    <div className="text-xl font-bold text-emerald-600">RM {reportTotal.toLocaleString()}</div>
                  </div>
                </div>

                {reportEarnings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No earnings found for this period.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Rental</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportEarnings.map((e, i) => (
                        <TableRow key={e.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{e.tenant_name}</TableCell>
                          <TableCell className="text-sm">{e.building} · {e.unit} · {e.room}</TableCell>
                          <TableCell>RM {e.exact_rental.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{e.commission_type}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">RM {e.commission_amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-foreground">
                        <TableCell colSpan={5} className="font-bold">Total ({reportEarnings.length} deals)</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">RM {reportTotal.toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>Close</Button>
            {reportEarnings.length > 0 && (
              <Button onClick={handlePrintReport}>
                <FileText className="h-4 w-4 mr-1" /> Print / Save PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">Payouts</h2>
        <Button onClick={() => setShowReportDialog(true)}><FileText className="h-4 w-4 mr-1" /> Generate Report</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search agent..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="agent_name" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="total_deals" currentSort={sort} onSort={handleSort}>Deals</SortableTableHead>
                <SortableTableHead sortKey="total_earnings" currentSort={sort} onSort={handleSort}>Total Earnings</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No agents found</TableCell></TableRow>
              ) : paged.map(row => (
                <TableRow key={row.agent_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{row.agent_name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{row.total_deals}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">RM {row.total_earnings.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewAgent(row)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setReportAgentId(row.agent_id); setShowReportDialog(true); }} title="Generate Report"><FileText className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
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
          <span>of {agentRows.length}</span>
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

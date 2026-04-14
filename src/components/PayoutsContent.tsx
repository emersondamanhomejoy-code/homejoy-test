import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronLeft, ChevronRight, Plus, Check, X, DollarSign, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Payout {
  id: string;
  agent_id: string;
  agent_name: string;
  deal_count: number;
  total_amount: number;
  pay_cycle: string;
  status: string;
  generated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

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

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
];

export function PayoutsContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payouts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payout[];
    },
  });

  const { data: allEarnings = [] } = useQuery({
    queryKey: ["all-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("earnings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Earning[];
    },
  });

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, name, email").then(({ data }) => {
      if (data) setProfiles(data.map(p => ({ user_id: p.user_id || "", name: p.name, email: p.email })));
    });
  }, []);

  const getAgentName = (id: string) => {
    const p = profiles.find(pr => pr.user_id === id);
    return p?.name || p?.email || id.slice(0, 8);
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payCycleFilter, setPayCycleFilter] = useState("all");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Generate payout dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateCycle, setGenerateCycle] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState(false);

  // View detail dialog
  const [viewPayout, setViewPayout] = useState<Payout | null>(null);

  // Confirm dialogs
  const [approveTarget, setApproveTarget] = useState<Payout | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<Payout | null>(null);
  const [saving, setSaving] = useState(false);

  const payCycleOptions = useMemo(() => {
    const cycles = new Set<string>();
    payouts.forEach(p => { if (p.pay_cycle) cycles.add(p.pay_cycle); });
    allEarnings.forEach(e => { if (e.pay_cycle) cycles.add(e.pay_cycle); });
    return Array.from(cycles).sort().reverse();
  }, [payouts, allEarnings]);

  // Unpaid earnings for generating payouts
  const unpaidEarnings = useMemo(() => {
    return allEarnings.filter(e => e.status === "pending" && !e.payout_id);
  }, [allEarnings]);

  const filtered = useMemo(() => {
    let list = payouts;
    if (statusFilter !== "all") list = list.filter(p => p.status === statusFilter);
    if (payCycleFilter !== "all") list = list.filter(p => p.pay_cycle === payCycleFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p => p.agent_name.toLowerCase().includes(s));
    }
    return sortData(list, (p: Payout, key: string) => {
      const m: Record<string, any> = {
        agent_name: p.agent_name,
        deal_count: p.deal_count,
        total_amount: p.total_amount,
        pay_cycle: p.pay_cycle,
        status: p.status,
        created_at: p.created_at,
      };
      return m[key] ?? "";
    });
  }, [payouts, statusFilter, payCycleFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: payouts.length };
    payouts.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [payouts]);

  // ─── GENERATE PAYOUT BATCH ───
  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      // Group unpaid earnings by agent
      const cycleEarnings = unpaidEarnings.filter(e => {
        const cycle = e.pay_cycle || `${new Date(e.created_at).getFullYear()}-${String(new Date(e.created_at).getMonth() + 1).padStart(2, "0")}`;
        return cycle === generateCycle;
      });

      if (cycleEarnings.length === 0) {
        toast.error("No unpaid earnings found for this pay cycle");
        setGenerating(false);
        return;
      }

      const agentGroups = new Map<string, Earning[]>();
      cycleEarnings.forEach(e => {
        const list = agentGroups.get(e.agent_id) || [];
        list.push(e);
        agentGroups.set(e.agent_id, list);
      });

      // Create payout record per agent
      for (const [agentId, agentEarnings] of agentGroups) {
        const totalAmount = agentEarnings.reduce((s, e) => s + e.commission_amount, 0);
        const { data: payout, error: payoutErr } = await supabase.from("payouts").insert({
          agent_id: agentId,
          agent_name: getAgentName(agentId),
          deal_count: agentEarnings.length,
          total_amount: totalAmount,
          pay_cycle: generateCycle,
          status: "draft",
          generated_by: user.id,
        }).select().single();

        if (payoutErr) throw payoutErr;

        // Link earnings to payout
        const earningIds = agentEarnings.map(e => e.id);
        await supabase.from("earnings").update({ payout_id: payout.id, pay_cycle: generateCycle }).in("id", earningIds);
      }

      await logActivity("generate_payouts", "payout", generateCycle, { cycle: generateCycle, agent_count: agentGroups.size });
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      queryClient.invalidateQueries({ queryKey: ["all-earnings"] });
      toast.success(`Generated ${agentGroups.size} payout(s) for ${generateCycle}`);
      setShowGenerateDialog(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate payouts");
    } finally {
      setGenerating(false);
    }
  };

  // ─── APPROVE PAYOUT ───
  const handleApprove = async () => {
    if (!user || !approveTarget) return;
    setSaving(true);
    try {
      await supabase.from("payouts").update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", approveTarget.id);

      // Update linked earnings status
      await supabase.from("earnings").update({ status: "approved" }).eq("payout_id", approveTarget.id);

      await logActivity("approve_payout", "payout", approveTarget.id, { agent: approveTarget.agent_name, amount: approveTarget.total_amount });
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      queryClient.invalidateQueries({ queryKey: ["all-earnings"] });
      toast.success("Payout approved");
      setApproveTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── MARK PAID ───
  const handleMarkPaid = async () => {
    if (!user || !markPaidTarget) return;
    setSaving(true);
    try {
      await supabase.from("payouts").update({
        status: "paid",
        paid_at: new Date().toISOString(),
      }).eq("id", markPaidTarget.id);

      await supabase.from("earnings").update({ status: "paid" }).eq("payout_id", markPaidTarget.id);

      await logActivity("mark_payout_paid", "payout", markPaidTarget.id, { agent: markPaidTarget.agent_name, amount: markPaidTarget.total_amount });
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      queryClient.invalidateQueries({ queryKey: ["all-earnings"] });
      toast.success("Payout marked as paid");
      setMarkPaidTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // Earnings for a specific payout
  const payoutEarnings = useMemo(() => {
    if (!viewPayout) return [];
    return allEarnings.filter(e => e.payout_id === viewPayout.id);
  }, [viewPayout, allEarnings]);

  return (
    <div className="space-y-4">
      {/* View Payout Detail */}
      {viewPayout && (
        <Dialog open={Boolean(viewPayout)} onOpenChange={open => !open && setViewPayout(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={e => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Payout Detail — {viewPayout.agent_name}</DialogTitle></DialogHeader>
            <div className="px-6 pb-6 space-y-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Agent</span><span className="font-medium">{viewPayout.agent_name}</span></div>
                <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Pay Cycle</span><span className="font-medium">{viewPayout.pay_cycle}</span></div>
                <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Deals</span><span className="font-medium">{viewPayout.deal_count}</span></div>
                <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Total</span><span className="font-bold text-emerald-600">RM {viewPayout.total_amount.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Status</span><StatusBadge status={viewPayout.status} /></div>
                {viewPayout.approved_at && <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Approved At</span><span>{format(new Date(viewPayout.approved_at), "dd MMM yyyy, HH:mm")}</span></div>}
                {viewPayout.paid_at && <div className="flex justify-between text-sm py-1"><span className="text-muted-foreground">Paid At</span><span>{format(new Date(viewPayout.paid_at), "dd MMM yyyy, HH:mm")}</span></div>}
              </div>

              {payoutEarnings.length > 0 && (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Rental</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payoutEarnings.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.tenant_name}</TableCell>
                          <TableCell>{e.building}</TableCell>
                          <TableCell>{e.unit}</TableCell>
                          <TableCell>{e.room}</TableCell>
                          <TableCell>RM {e.exact_rental.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{e.commission_type}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">RM {e.commission_amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <DialogFooter className="px-6 pb-6">
              <Button variant="outline" onClick={() => setViewPayout(null)}>Close</Button>
              {viewPayout.status === "draft" && (
                <Button onClick={() => { setViewPayout(null); setApproveTarget(viewPayout); }} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
              )}
              {viewPayout.status === "approved" && (
                <Button onClick={() => { setViewPayout(null); setMarkPaidTarget(viewPayout); }}><DollarSign className="h-4 w-4 mr-1" /> Mark Paid</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={open => !generating && setShowGenerateDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Generate Payout Batch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Generate payout records for all unpaid earnings in the selected pay cycle.</p>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pay Cycle (YYYY-MM)</label>
              <Input value={generateCycle} onChange={e => setGenerateCycle(e.target.value)} placeholder="2026-04" />
            </div>
            <p className="text-sm text-muted-foreground">{unpaidEarnings.length} unpaid earning(s) total</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={generating}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>{generating ? "Generating..." : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={Boolean(approveTarget)} onOpenChange={open => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Payout?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve payout of <strong>RM {approveTarget?.total_amount.toLocaleString()}</strong> for <strong>{approveTarget?.agent_name}</strong> ({approveTarget?.pay_cycle})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={saving} className="bg-green-600 hover:bg-green-700">Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Paid Dialog */}
      <AlertDialog open={Boolean(markPaidTarget)} onOpenChange={open => !open && setMarkPaidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark payout of <strong>RM {markPaidTarget?.total_amount.toLocaleString()}</strong> for <strong>{markPaidTarget?.agent_name}</strong> as paid?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} disabled={saving}>Mark Paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Payouts</h2>
        <Button onClick={() => setShowGenerateDialog(true)}><Plus className="h-4 w-4 mr-1" /> Generate Payout</Button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label} ({statusCounts[tab.value] || 0})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search agent..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Select value={payCycleFilter} onValueChange={v => { setPayCycleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Cycles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {payCycleOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <SortableTableHead sortKey="deal_count" currentSort={sort} onSort={handleSort}>Deals</SortableTableHead>
                <SortableTableHead sortKey="total_amount" currentSort={sort} onSort={handleSort}>Total Amount</SortableTableHead>
                <SortableTableHead sortKey="pay_cycle" currentSort={sort} onSort={handleSort}>Pay Cycle</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Generated</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payouts found</TableCell></TableRow>
              ) : paged.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.agent_name}</TableCell>
                  <TableCell>{p.deal_count}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">RM {p.total_amount.toLocaleString()}</TableCell>
                  <TableCell>{p.pay_cycle}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewPayout(p)} title="View"><Eye className="h-4 w-4" /></Button>
                      {p.status === "draft" && (
                        <Button variant="ghost" size="icon" onClick={() => setApproveTarget(p)} title="Approve"><Check className="h-4 w-4 text-primary" /></Button>
                      )}
                      {p.status === "approved" && (
                        <Button variant="ghost" size="icon" onClick={() => setMarkPaidTarget(p)} title="Mark Paid"><DollarSign className="h-4 w-4 text-emerald-600" /></Button>
                      )}
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

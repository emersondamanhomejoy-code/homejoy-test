import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClaims, useUpdateClaimStatus, useUpdateClaim, useCreateClaim, Claim, ClaimItem } from "@/hooks/useClaims";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useMoveIns, MoveIn } from "@/hooks/useMoveIns";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SortableTableHead, useTableSort } from "@/components/SortableTableHead";
import { Eye, Pencil, Trash2, X, ChevronLeft, ChevronRight, Check, Ban, Undo2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useFormValidation, fieldClass, FieldError, FormErrorBanner } from "@/hooks/useFormValidation";

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

interface AgentCommissionConfig {
  commission_type: string;
  commission_config: any;
}

interface CreateClaimForm {
  agent_id: string;
  selectedMoveInIds: string[];
  description: string;
  bank_name: string;
  bank_account: string;
  account_holder: string;
}

export function ClaimsPage() {
  const { user, role } = useAuth();
  const canCreate = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const queryClient = useQueryClient();

  const { data: allClaims = [], isLoading } = useClaims();
  const { data: roomsData = [] } = useRooms();
  const { data: approvedBookings = [] } = useBookings("approved");
  const { data: allMoveIns = [] } = useMoveIns();
  const approvedMoveIns = useMemo(() => allMoveIns.filter(m => m.status === "approved"), [allMoveIns]);
  const updateClaimStatus = useUpdateClaimStatus();
  const updateClaim = useUpdateClaim();
  const createClaim = useCreateClaim();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [payoutFilter, setPayoutFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sort, handleSort, sortData } = useTableSort("created_at", "desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [viewClaim, setViewClaim] = useState<Claim | null>(null);
  const [editClaim, setEditClaim] = useState<Claim | null>(null);
  const [editForm, setEditForm] = useState({ description: "", bank_name: "", bank_account: "", account_holder: "", payout_date: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClaimForm>({
    agent_id: "",
    selectedMoveInIds: [],
    description: "",
    bank_name: "",
    bank_account: "",
    account_holder: "",
  });
  const [saving, setSaving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState<Claim | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState<Claim | null>(null);
  const [selectedUndoItems, setSelectedUndoItems] = useState<string[]>([]);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const claimRejectValidation = useFormValidation();
  const claimCancelValidation = useFormValidation();
  const claimCreateValidation = useFormValidation();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentCommissionConfig>>({});

  useEffect(() => {
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map((p) => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });

    supabase.from("user_roles").select("user_id, commission_type, commission_config").eq("role", "agent").then(({ data }) => {
      if (!data) return;
      const mapped = data.reduce((acc, row) => {
        acc[row.user_id] = {
          commission_type: row.commission_type,
          commission_config: row.commission_config,
        };
        return acc;
      }, {} as Record<string, AgentCommissionConfig>);
      setAgentConfigs(mapped);
    });
  }, []);

  const getAgentName = (id: string) => {
    const matched = users.find((item) => item.id === id);
    return matched?.name || matched?.email || id.slice(0, 8);
  };

  const agentUsers = useMemo(
    () => users.filter((u) => approvedMoveIns.some((m) => m.agent_id === u.id)),
    [users, approvedMoveIns],
  );
  const agentOptions = useMemo(() => [...new Set(users.map((u) => u.name || u.email).filter(Boolean))].sort(), [users]);
  const locationOptions = useMemo(() => [...new Set(roomsData.map((r) => r.location).filter(Boolean))].sort(), [roomsData]);
  const buildingOptions = useMemo(() => [...new Set(roomsData.map((r) => r.building).filter(Boolean))].sort(), [roomsData]);
  const payoutOptions = useMemo(() => {
    const dates = allClaims.map((claim) => claim.payout_date).filter(Boolean) as string[];
    return [...new Set(dates)].sort();
  }, [allClaims]);

  const activeClaimBookingIds = useMemo(
    () => new Set(allClaims.filter((claim) => !["cancelled", "rejected"].includes(claim.status) && claim.booking_id).map((claim) => claim.booking_id as string)),
    [allClaims],
  );
  const activeClaimItemKeys = useMemo(() => {
    const keys = new Set<string>();
    allClaims.forEach((claim) => {
      (claim.claim_items || []).forEach((item) => {
        if (item.status !== "claimable") keys.add(`${item.room_id || ""}:${item.tenant_name}`);
      });
    });
    return keys;
  }, [allClaims]);

  const availableCreateMoveIns = useMemo(() => {
    if (!createForm.agent_id) return [] as MoveIn[];
    return approvedMoveIns.filter((m) => {
      if (m.agent_id !== createForm.agent_id) return false;
      if (m.booking_id && activeClaimBookingIds.has(m.booking_id)) return false;
      const itemKey = `${m.room_id || ""}:${m.tenant_name}`;
      if (activeClaimItemKeys.has(itemKey)) return false;
      return true;
    });
  }, [approvedMoveIns, createForm.agent_id, activeClaimBookingIds, activeClaimItemKeys]);

  const selectedCreateMoveIns = useMemo(
    () => availableCreateMoveIns.filter((m) => createForm.selectedMoveInIds.includes(m.id)),
    [availableCreateMoveIns, createForm.selectedMoveInIds],
  );

  const calculateCommission = (moveIn: MoveIn, agentId: string) => {
    const config = agentConfigs[agentId];
    const commissionType = config?.commission_type || "internal_basic";
    const commissionConfig = config?.commission_config || null;
    // Get rent from the linked booking if available
    const booking = approvedBookings.find(b => b.id === moveIn.booking_id);
    const rent = booking?.monthly_salary || 0;
    const duration = moveIn.booking?.contract_months || booking?.contract_months || 12;
    const durationMultiplier = duration / 12;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyDeals = approvedMoveIns.filter(
      (item) => item.agent_id === agentId && new Date(item.created_at) >= monthStart,
    ).length;

    let base = 0;
    if (commissionType === "external") {
      const percentage = commissionConfig?.percentage ?? 100;
      base = Math.round(rent * percentage / 100);
    } else if (commissionType === "internal_full") {
      const tiers = commissionConfig?.tiers || [
        { min: 1, max: 10, percentage: 70 },
        { min: 11, max: 20, percentage: 75 },
      ];
      const tier = tiers.find((item: any) => monthlyDeals >= item.min && (item.max === null || monthlyDeals <= item.max));
      const percentage = tier?.percentage ?? 70;
      base = Math.round(rent * percentage / 100);
    } else {
      const tiers = commissionConfig?.tiers || [
        { min: 1, max: 5, amount: 200 },
        { min: 6, max: 10, amount: 300 },
        { min: 11, max: null, amount: 400 },
      ];
      const tier = tiers.find((item: any) => monthlyDeals >= item.min && (item.max === null || monthlyDeals <= item.max));
      base = tier?.amount ?? 200;
    }

    return Math.round(base * durationMultiplier);
  };

  const getCommissionLabel = (agentId: string) => {
    const config = agentConfigs[agentId];
    if (!config) return "Internal Basic";
    if (config.commission_type === "external") return `External (${config.commission_config?.percentage ?? 100}%)`;
    if (config.commission_type === "internal_full") return "Internal Full";
    return "Internal Basic";
  };

  const buildClaimDescription = (moveIns: MoveIn[]) => {
    if (moveIns.length === 0) return "";
    const summary = moveIns
      .map((m) => `${m.room?.building || ""} ${m.room?.unit || ""} ${m.room?.room || ""} (${m.tenant_name})`)
      .join(", ");
    return `Commission - ${summary}`;
  };

  const toggleCreateBooking = (moveInId: string, checked: boolean) => {
    const nextIds = checked
      ? [...createForm.selectedMoveInIds, moveInId]
      : createForm.selectedMoveInIds.filter((id) => id !== moveInId);
    const nextMoveIns = availableCreateMoveIns.filter((m) => nextIds.includes(m.id));
    setCreateForm((current) => ({
      ...current,
      selectedMoveInIds: nextIds,
      description: buildClaimDescription(nextMoveIns),
    }));
  };

  const toggleAllCreateBookings = (checked: boolean) => {
    const nextIds = checked ? availableCreateMoveIns.map((m) => m.id) : [];
    const nextMoveIns = checked ? availableCreateMoveIns : [];
    setCreateForm((current) => ({
      ...current,
      selectedMoveInIds: nextIds,
      description: buildClaimDescription(nextMoveIns),
    }));
  };

  const totalCreateAmount = useMemo(
    () => selectedCreateMoveIns.reduce((sum, m) => sum + calculateCommission(m, createForm.agent_id), 0),
    [selectedCreateMoveIns, createForm.agent_id, agentConfigs, approvedMoveIns],
  );

  const filtered = useMemo(() => {
    let list = allClaims;
    if (statusFilter !== "all") list = list.filter((claim) => claim.status === statusFilter);
    if (search.trim()) {
      const keyword = search.toLowerCase();
      list = list.filter(
        (claim) =>
          claim.id.toLowerCase().includes(keyword) ||
          claim.description.toLowerCase().includes(keyword) ||
          getAgentName(claim.agent_id).toLowerCase().includes(keyword),
      );
    }
    if (agentFilter.length) list = list.filter((claim) => agentFilter.includes(getAgentName(claim.agent_id)));
    if (payoutFilter.length) list = list.filter((claim) => claim.payout_date && payoutFilter.includes(claim.payout_date));
    if (dateFrom) list = list.filter((claim) => claim.created_at >= dateFrom);
    if (dateTo) list = list.filter((claim) => claim.created_at <= `${dateTo}T23:59:59`);

    return sortData(list, (claim: Claim, key: string) => {
      const sortable: Record<string, string | number> = {
        id: claim.id,
        agent: getAgentName(claim.agent_id),
        rooms: (claim.claim_items || []).length,
        amount: claim.amount,
        status: claim.status,
        payout_date: claim.payout_date || "",
        created_at: claim.created_at,
      };
      return sortable[key] ?? "";
    });
  }, [allClaims, statusFilter, search, agentFilter, payoutFilter, dateFrom, dateTo, sort, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleApprove = async (claim: Claim) => {
    if (!user) return;
    const history = [...(claim.history || []), { action: "approved", by: user.email, at: new Date().toISOString() }];
    await updateClaimStatus.mutateAsync({ id: claim.id, status: "approved", reviewed_by: user.id, history });
    await logActivity("approve_claim", "claim", claim.id, { amount: claim.amount });
    toast.success("Claim approved");
    setViewClaim(null);
  };

  const handleReject = async () => {
    if (!user || !showRejectDialog) return;
    const rules = { rejectReason: () => !rejectReason.trim() ? "Reject reason is required" : null };
    if (!claimRejectValidation.validate({ rejectReason }, rules)) return;
    const claim = showRejectDialog;
    const history = [...(claim.history || []), { action: "rejected", by: user.email, at: new Date().toISOString(), reason: rejectReason }];
    await updateClaimStatus.mutateAsync({ id: claim.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason, history });
    await logActivity("reject_claim", "claim", claim.id, { amount: claim.amount, reason: rejectReason });
    toast.success("Claim rejected");
    setShowRejectDialog(null);
    setRejectReason("");
    setViewClaim(null);
    setEditClaim(null);
  };

  const handleCancel = async () => {
    if (!user || !showCancelDialog) return;
    const rules = { cancelReason: () => !cancelReason.trim() ? "Cancel reason is required" : null };
    if (!claimCancelValidation.validate({ cancelReason }, rules)) return;
    const claim = showCancelDialog;
    const history = [...(claim.history || []), { action: "cancelled", by: user.email, at: new Date().toISOString(), reason: cancelReason }];
    await updateClaimStatus.mutateAsync({ id: claim.id, status: "cancelled", reviewed_by: user.id, cancel_reason: cancelReason, history });
    if (claim.claim_items?.length) {
      for (const item of claim.claim_items) {
        await supabase.from("claim_items").update({ status: "claimable" }).eq("id", item.id);
      }
    }
    await logActivity("cancel_claim", "claim", claim.id, { amount: claim.amount, reason: cancelReason });
    toast.success("Claim cancelled — items returned to claimable");
    setShowCancelDialog(null);
    setCancelReason("");
    setViewClaim(null);
    setEditClaim(null);
    queryClient.invalidateQueries({ queryKey: ["claims"] });
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    const claim = showDeleteDialog;
    if (claim.claim_items?.length) {
      for (const item of claim.claim_items) {
        await supabase.from("claim_items").update({ status: "claimable" }).eq("id", item.id);
      }
    }
    await supabase.from("claim_items").delete().eq("claim_id", claim.id);
    await supabase.from("claims").delete().eq("id", claim.id);
    await logActivity("delete_claim", "claim", claim.id, { amount: claim.amount });
    toast.success("Claim deleted — items returned to claimable");
    setShowDeleteDialog(null);
    setViewClaim(null);
    setEditClaim(null);
    queryClient.invalidateQueries({ queryKey: ["claims"] });
  };

  const handleUndoItems = async () => {
    if (!user || !viewClaim || selectedUndoItems.length === 0) return;
    const claim = viewClaim;
    for (const itemId of selectedUndoItems) {
      await supabase.from("claim_items").update({ status: "claimable" }).eq("id", itemId);
    }
    const remainingItems = (claim.claim_items || []).filter((item) => !selectedUndoItems.includes(item.id));
    const newAmount = remainingItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const history = [...(claim.history || []), { action: "adjusted", by: user.email, at: new Date().toISOString(), removed_items: selectedUndoItems.length }];
    const nextStatus = remainingItems.length === 0 ? "cancelled" : "adjusted";
    await updateClaim.mutateAsync({ id: claim.id, amount: newAmount, status: nextStatus, history });
    await logActivity("adjust_claim", "claim", claim.id, { removed_items: selectedUndoItems.length, new_amount: newAmount });
    toast.success(`${selectedUndoItems.length} item(s) returned to claimable`);
    setSelectedUndoItems([]);
    setShowUndoDialog(false);
    setViewClaim(null);
  };

  const handleCreate = async () => {
    const rules: Record<string, (v: any) => string | null> = {
      agent_id: () => !createForm.agent_id ? "Please select an agent" : null,
      selectedMoveInIds: () => createForm.selectedMoveInIds.length === 0 ? "Please select at least one approved move-in" : null,
      description: () => !createForm.description.trim() ? "Description is required" : null,
    };
    if (!claimCreateValidation.validate(createForm, rules)) return;

    setSaving(true);
    try {
      const history = [{ action: "created", by: user.email, at: new Date().toISOString(), created_for_agent: getAgentName(createForm.agent_id), item_count: selectedCreateMoveIns.length }];
      const createdClaim = await createClaim.mutateAsync({
        agent_id: createForm.agent_id,
        booking_id: selectedCreateMoveIns.length === 1 ? (selectedCreateMoveIns[0].booking_id || null) : null,
        amount: totalCreateAmount,
        description: createForm.description,
        bank_name: createForm.bank_name,
        bank_account: createForm.bank_account,
        account_holder: createForm.account_holder,
        history,
      });

      const claimItemsPayload = selectedCreateMoveIns.map((booking) => ({
        claim_id: createdClaim.id,
        room_id: booking.room_id,
        building: booking.room?.building || "",
        unit: booking.room?.unit || "",
        room: booking.room?.room || "",
        tenant_name: booking.tenant_name,
        amount: calculateCommission(booking, createForm.agent_id),
        status: "pending",
      }));

      const { error } = await supabase.from("claim_items").insert(claimItemsPayload);
      if (error) {
        await supabase.from("claims").delete().eq("id", createdClaim.id);
        throw error;
      }

      await logActivity("create_claim", "claim", createdClaim.id, {
        agent: getAgentName(createForm.agent_id),
        amount: totalCreateAmount,
        room_count: selectedCreateMoveIns.length,
      });

      queryClient.invalidateQueries({ queryKey: ["claims"] });
      toast.success("Claim created");
      setCreateOpen(false);
      setCreateForm({ agent_id: "", selectedMoveInIds: [], description: "", bank_name: "", bank_account: "", account_holder: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to create claim");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (claim: Claim) => {
    setEditClaim(claim);
    setEditForm({
      description: claim.description,
      bank_name: claim.bank_name,
      bank_account: claim.bank_account,
      account_holder: claim.account_holder,
      payout_date: claim.payout_date || "",
    });
  };

  const saveEdit = async () => {
    if (!editClaim || !user) return;
    setSaving(true);
    try {
      const history = [...(editClaim.history || []), { action: "edited", by: user.email, at: new Date().toISOString() }];
      await updateClaim.mutateAsync({
        id: editClaim.id,
        description: editForm.description,
        bank_name: editForm.bank_name,
        bank_account: editForm.bank_account,
        account_holder: editForm.account_holder,
        payout_date: editForm.payout_date || null,
        history,
      });
      await logActivity("edit_claim", "claim", editClaim.id, { agent: getAgentName(editClaim.agent_id) });
      toast.success("Claim updated");
      setEditClaim(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters =
    agentFilter.length > 0 ||
    locationFilter.length > 0 ||
    buildingFilter.length > 0 ||
    payoutFilter.length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setAgentFilter([]);
    setLocationFilter([]);
    setBuildingFilter([]);
    setPayoutFilter([]);
    setDateFrom("");
    setDateTo("");
  };

  const sectionCard = (emoji: string, title: string, children: React.ReactNode) => (
    <div className="rounded-lg bg-muted/50 p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2 text-base font-bold">{emoji} {title}</div>
      {children}
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between py-1.5 text-sm gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );

  const fieldClassName = "w-full rounded-lg border bg-secondary px-4 py-3 text-sm text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClassName = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  const renderClaimItems = (items: ClaimItem[], showUndo: boolean) => (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {showUndo && <TableHead className="w-10"></TableHead>}
            <TableHead>Room</TableHead>
            <TableHead>Building</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={showUndo ? 7 : 6} className="py-4 text-center text-muted-foreground">No claim items</TableCell></TableRow>
          ) : items.map((item) => (
            <TableRow key={item.id}>
              {showUndo && (
                <TableCell>
                  <Checkbox
                    checked={selectedUndoItems.includes(item.id)}
                    onCheckedChange={(checked) => {
                      setSelectedUndoItems((current) => checked ? [...current, item.id] : current.filter((id) => id !== item.id));
                    }}
                  />
                </TableCell>
              )}
              <TableCell>{item.room}</TableCell>
              <TableCell>{item.building}</TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell>{item.tenant_name}</TableCell>
              <TableCell className="font-medium">RM{Number(item.amount).toLocaleString()}</TableCell>
              <TableCell><StatusBadge status={item.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderViewModal = (claim: Claim) => {
    const items = claim.claim_items || [];
    return (
      <div className="space-y-5 py-4">
        {sectionCard("📋", "Claim Summary", (
          <div>
            {infoRow("Claim ID", <span className="font-mono text-xs">{claim.id}</span>)}
            {infoRow("Agent", getAgentName(claim.agent_id))}
            {infoRow("Status", <StatusBadge status={claim.status} />)}
            {infoRow("Total Amount", `RM${Number(claim.amount).toLocaleString()}`)}
            {infoRow("Payout Date", claim.payout_date ? format(new Date(claim.payout_date), "dd MMM yyyy") : "—")}
            {infoRow("Submitted At", format(new Date(claim.created_at), "dd MMM yyyy, HH:mm"))}
            {claim.reviewed_at && infoRow("Reviewed At", format(new Date(claim.reviewed_at), "dd MMM yyyy, HH:mm"))}
          </div>
        ))}

        {sectionCard("📦", `Claim Items (${items.length})`, (
          <div className="space-y-3">
            {renderClaimItems(items, claim.status === "approved" && isSuperAdmin)}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total ({items.length} items)</span>
              <span>RM{items.reduce((sum, item) => sum + Number(item.amount), 0).toLocaleString()}</span>
            </div>
            {claim.status === "approved" && isSuperAdmin && selectedUndoItems.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowUndoDialog(true)}>
                <Undo2 className="mr-1 h-3 w-3" /> Undo {selectedUndoItems.length} Selected Item(s)
              </Button>
            )}
          </div>
        ))}

        {sectionCard("💰", "Bank Details", (
          <div>
            {infoRow("Description", claim.description)}
            {infoRow("Bank", claim.bank_name || "—")}
            {infoRow("Account", claim.bank_account || "—")}
            {infoRow("Holder", claim.account_holder || "—")}
          </div>
        ))}

        {claim.reject_reason && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            <span className="font-semibold">Reject Reason:</span> {claim.reject_reason}
          </div>
        )}
        {claim.cancel_reason && (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <span className="font-semibold">Cancel Reason:</span> {claim.cancel_reason}
          </div>
        )}

        {(claim.history || []).length > 0 && sectionCard("📜", "History", (
          <div className="space-y-2">
            {(claim.history || []).map((historyItem: any, index: number) => (
              <div key={index} className="rounded-lg border bg-background p-3 text-xs">
                <span className="font-semibold capitalize">{historyItem.action}</span> by {historyItem.by} — {historyItem.at ? format(new Date(historyItem.at), "dd MMM yyyy, HH:mm") : ""}
                {historyItem.reason && <div className="mt-1 text-muted-foreground">Reason: {historyItem.reason}</div>}
                {historyItem.removed_items && <div className="mt-1 text-muted-foreground">{historyItem.removed_items} item(s) removed</div>}
              </div>
            ))}
          </div>
        ))}

        {claim.status === "pending" && (
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => handleApprove(claim)} size="sm"><Check className="mr-1 h-3 w-3" /> Approve</Button>
            <Button variant="destructive" size="sm" onClick={() => setShowRejectDialog(claim)}><X className="mr-1 h-3 w-3" /> Reject</Button>
            <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(claim)}><Ban className="mr-1 h-3 w-3" /> Cancel</Button>
          </div>
        )}
        {(claim.status === "rejected" || claim.status === "cancelled") && (
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowDeleteDialog(claim)}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        )}
        {claim.status === "approved" && isSuperAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(claim)}>
            <Undo2 className="mr-1 h-3 w-3" /> Adjust / Cancel (Override)
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {createOpen && (
        <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Create Claim</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <div className="space-y-5 py-4">
                {sectionCard("👤", "Assign Agent", (
                  <div className="space-y-1">
                    <label className={labelClassName}>Agent</label>
                    <select
                      className={fieldClassName}
                      value={createForm.agent_id}
                      onChange={(e) => setCreateForm({ agent_id: e.target.value, selectedMoveInIds: [], description: "", bank_name: "", bank_account: "", account_holder: "" })}
                    >
                      <option value="">Select agent</option>
                      {agentUsers.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name || agent.email}</option>
                      ))}
                    </select>
                    {createForm.agent_id && <p className="text-xs text-muted-foreground">Commission: {getCommissionLabel(createForm.agent_id)}</p>}
                  </div>
                ))}

                {sectionCard("📦", "Approved Move-ins", (
                  <div className="space-y-3">
                    {availableCreateMoveIns.length === 0 ? (
                      <div className="rounded-lg bg-secondary/30 p-4 text-sm text-muted-foreground">
                        {createForm.agent_id ? "No eligible approved move-ins available for this agent." : "Select an agent first."}
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border bg-secondary/30 p-3 max-h-72 overflow-y-auto">
                        {availableCreateMoveIns.length > 1 && (
                          <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded"
                              checked={createForm.selectedMoveInIds.length === availableCreateMoveIns.length}
                              onChange={(e) => toggleAllCreateBookings(e.target.checked)}
                            />
                            <span className="font-medium">Select All ({availableCreateMoveIns.length})</span>
                          </label>
                        )}
                        {availableCreateMoveIns.map((booking) => {
                          const amount = calculateCommission(booking, createForm.agent_id);
                          const checked = createForm.selectedMoveInIds.includes(booking.id);
                          return (
                            <label key={booking.id} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded"
                                checked={checked}
                                onChange={(e) => toggleCreateBooking(booking.id, e.target.checked)}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{booking.room?.building} {booking.room?.unit} {booking.room?.room}</div>
                                  <div className="text-sm font-semibold">RM{amount.toLocaleString()}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{booking.tenant_name} · Move-in {booking.booking?.move_in_date ? format(new Date(booking.booking.move_in_date), "dd MMM yyyy") : "—"}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {sectionCard("💰", "Claim Details", (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-secondary/30 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Selected Items</span>
                        <span className="font-semibold">{selectedCreateMoveIns.length}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-muted-foreground">Total Amount</span>
                        <span className="font-semibold">RM{totalCreateAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClassName}>Description</label>
                      <Textarea className="bg-secondary" rows={3} value={createForm.description} onChange={(e) => setCreateForm((current) => ({ ...current, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className={labelClassName}>Bank Name</label>
                        <Input className="bg-secondary" value={createForm.bank_name} onChange={(e) => setCreateForm((current) => ({ ...current, bank_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClassName}>Bank Account</label>
                        <Input className="bg-secondary" value={createForm.bank_account} onChange={(e) => setCreateForm((current) => ({ ...current, bank_account: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClassName}>Account Holder</label>
                        <Input className="bg-secondary" value={createForm.account_holder} onChange={(e) => setCreateForm((current) => ({ ...current, account_holder: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                ))}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Claim"}</Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {viewClaim && (
        <Dialog open={Boolean(viewClaim)} onOpenChange={(open) => { if (!open) { setViewClaim(null); setSelectedUndoItems([]); } }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>View Claim</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              {renderViewModal(allClaims.find((claim) => claim.id === viewClaim.id) || viewClaim)}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {editClaim && (
        <Dialog open={Boolean(editClaim)} onOpenChange={(open) => !open && !saving && setEditClaim(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-0"><DialogTitle>Edit Claim — {getAgentName(editClaim.agent_id)}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
              <div className="space-y-5 py-4">
                {sectionCard("📋", "Claim Summary (Read-Only)", (
                  <div>
                    {infoRow("Claim ID", <span className="font-mono text-xs">{editClaim.id}</span>)}
                    {infoRow("Agent", getAgentName(editClaim.agent_id))}
                    {infoRow("Status", <StatusBadge status={editClaim.status} />)}
                    {infoRow("Total Amount", `RM${Number(editClaim.amount).toLocaleString()}`)}
                    {infoRow("Submitted At", format(new Date(editClaim.created_at), "dd MMM yyyy, HH:mm"))}
                  </div>
                ))}

                {sectionCard("📦", `Claim Items (${(editClaim.claim_items || []).length})`, (
                  renderClaimItems(editClaim.claim_items || [], false)
                ))}

                {sectionCard("✏️", "Editable Details", (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className={labelClassName}>Description</label>
                      <Textarea className="bg-secondary" value={editForm.description} onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClassName}>Payout Date</label>
                      <Input type="date" className="bg-secondary" value={editForm.payout_date} onChange={(e) => setEditForm((current) => ({ ...current, payout_date: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className={labelClassName}>Bank Name</label>
                        <Input className="bg-secondary" value={editForm.bank_name} onChange={(e) => setEditForm((current) => ({ ...current, bank_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClassName}>Bank Account</label>
                        <Input className="bg-secondary" value={editForm.bank_account} onChange={(e) => setEditForm((current) => ({ ...current, bank_account: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClassName}>Account Holder</label>
                        <Input className="bg-secondary" value={editForm.account_holder} onChange={(e) => setEditForm((current) => ({ ...current, account_holder: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                ))}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditClaim(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={Boolean(showRejectDialog)} onOpenChange={(open) => !open && (setShowRejectDialog(null), setRejectReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reject Claim?</AlertDialogTitle><AlertDialogDescription>Enter the rejection reason.</AlertDialogDescription></AlertDialogHeader>
          <Textarea placeholder="Reason (required)..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim()} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(showCancelDialog)} onOpenChange={(open) => !open && (setShowCancelDialog(null), setCancelReason(""))}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel Claim?</AlertDialogTitle><AlertDialogDescription>Items will return to claimable.</AlertDialogDescription></AlertDialogHeader>
          <Textarea placeholder="Reason (required)..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={!cancelReason.trim()}>Cancel Claim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(showDeleteDialog)} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Claim?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Items will return to claimable.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUndoDialog} onOpenChange={(open) => !open && setShowUndoDialog(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Selected Items?</AlertDialogTitle>
            <AlertDialogDescription>{selectedUndoItems.length} item(s) will be returned to claimable. My Deals and Total Commission will recalculate.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndoItems}>Confirm Undo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Claims</h2>
        {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Create</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search ID, agent, description..." className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="adjusted">Adjusted</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground"><X className="mr-1 h-3 w-3" /> Clear</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MultiSelectFilter label="Agent" placeholder="All" options={agentOptions} selected={agentFilter} onApply={(value) => { setAgentFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Location" placeholder="All" options={locationOptions} selected={locationFilter} onApply={(value) => { setLocationFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Building" placeholder="All" options={buildingOptions} selected={buildingFilter} onApply={(value) => { setBuildingFilter(value); setPage(0); }} />
        <MultiSelectFilter label="Payout Window" placeholder="All" options={payoutOptions} selected={payoutFilter} onApply={(value) => { setPayoutFilter(value); setPage(0); }} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date From</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date To</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="id" currentSort={sort} onSort={handleSort}>Claim ID</SortableTableHead>
                <SortableTableHead sortKey="agent" currentSort={sort} onSort={handleSort}>Agent</SortableTableHead>
                <SortableTableHead sortKey="rooms" currentSort={sort} onSort={handleSort}>Rooms</SortableTableHead>
                <SortableTableHead sortKey="amount" currentSort={sort} onSort={handleSort}>Total Amount</SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="payout_date" currentSort={sort} onSort={handleSort}>Payout Date</SortableTableHead>
                <SortableTableHead sortKey="created_at" currentSort={sort} onSort={handleSort}>Submitted</SortableTableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No claims found</TableCell></TableRow>
              ) : paged.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-mono text-xs">{claim.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{getAgentName(claim.agent_id)}</TableCell>
                  <TableCell className="text-sm">{(claim.claim_items || []).length}</TableCell>
                  <TableCell className="font-medium">RM{Number(claim.amount).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={claim.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{claim.payout_date ? format(new Date(claim.payout_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(claim.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewClaim(claim)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(claim)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      {(claim.status === "rejected" || claim.status === "cancelled") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(claim)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                      {(claim.status === "pending" || claim.status === "approved") && (
                        <Button variant="ghost" size="icon" onClick={() => setShowCancelDialog(claim)} title="Cancel"><Ban className="h-4 w-4 text-muted-foreground" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(0); }}>
            <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>of {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

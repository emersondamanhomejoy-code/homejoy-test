import { useState, useMemo, useEffect } from "react";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { useRooms, useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

const initialForm = {
  agentId: "",
  roomId: "",
  tenantName: "", phone: "", email: "", icPassport: "",
  gender: "", race: "", nationality: "", moveInDate: "",
  occupation: "", tenancyDuration: "12", monthlyRental: "",
  paxStaying: "1", accessCardCount: "0",
  tenant2Name: "", tenant2Phone: "", tenant2Email: "", tenant2IcPassport: "",
  tenant2Race: "", tenant2Nationality: "", tenant2Occupation: "",
  emergency1Name: "", emergency1Phone: "", emergency1Relationship: "",
  emergency2Name: "", emergency2Phone: "", emergency2Relationship: "",
  parkingCount: "0", carPlates: [""] as string[],
  advance: "", electricityReload: "",
};

export function BookingsContent() {
  const { user } = useAuth();
  const { data: allBookings = [], isLoading } = useBookings();
  const updateBookingStatus = useUpdateBookingStatus();
  const { data: roomsData = [] } = useRooms();
  const { data: unitsData = [] } = useUnits();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ passport: File[]; offerLetter: File[]; transferSlip: File[] }>({ passport: [], offerLetter: [], transferSlip: [] });

  // Fetch users/agents
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [agents, setAgents] = useState<(UserInfo & { roles: string[] })[]>([]);
  useEffect(() => {
    // Fetch profiles
    supabase.from("profiles").select("user_id, email, name").then(({ data }) => {
      if (data) setUsers(data.map(p => ({ id: p.user_id || "", email: p.email, name: p.name })));
    });
    // Fetch agents (users with agent role)
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

  // Available rooms for booking
  const availableRooms = useMemo(() => {
    return roomsData.filter(r => r.room_type !== "Car Park" && r.status === "Available");
  }, [roomsData]);

  const selectedRoom = useMemo(() => {
    return roomsData.find(r => r.id === form.roomId) || null;
  }, [roomsData, form.roomId]);

  const filtered = useMemo(() => {
    let list = allBookings;
    if (statusFilter && statusFilter !== "all") {
      list = list.filter(b => b.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b =>
        b.tenant_name.toLowerCase().includes(s) ||
        b.id.toLowerCase().includes(s) ||
        (b.room?.building || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [allBookings, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const statusBadge = (status: string) => {
    const cls = status === "pending"
      ? "bg-yellow-500/20 text-yellow-600"
      : status === "approved"
        ? "bg-green-500/20 text-green-600"
        : status === "cancelled"
          ? "bg-gray-500/20 text-gray-500"
          : "bg-red-500/20 text-red-600";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status.toUpperCase()}</span>;
  };

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const handleCreateBooking = async () => {
    if (!user) return;
    if (!form.agentId) { alert("Please select an agent"); return; }
    if (!form.roomId) { alert("Please select a room"); return; }
    if (!form.tenantName.trim()) { alert("Please fill in tenant name"); return; }
    if (!form.phone.trim()) { alert("Please fill in contact number"); return; }
    if (!form.moveInDate) { alert("Please select move-in date"); return; }
    if (!form.gender) { alert("Please select gender"); return; }
    if (!form.emergency1Name || !form.emergency1Phone || !form.emergency1Relationship) { alert("Please complete Emergency Contact 1"); return; }
    if (!form.emergency2Name || !form.emergency2Phone || !form.emergency2Relationship) { alert("Please complete Emergency Contact 2"); return; }

    setSubmitting(true);
    try {
      const passportPaths = await Promise.all(uploadedFiles.passport.map(f => uploadFile(f, "passport")));
      const offerPaths = await Promise.all(uploadedFiles.offerLetter.map(f => uploadFile(f, "offer-letter")));
      const slipPaths = await Promise.all(uploadedFiles.transferSlip.map(f => uploadFile(f, "transfer-slip")));

      const room = roomsData.find(r => r.id === form.roomId);
      const unitCfg = unitsData.find(u => u.id === room?.unit_id);
      const depMul = unitCfg?.deposit_multiplier ?? 1.5;
      const unitAdminFee = unitCfg?.admin_fee ?? 330;
      const perCardCost = unitCfg?.access_card_deposit ?? 0;
      const cardCount = Number(form.accessCardCount) || 0;
      const advance = Number(form.advance) || 0;
      const deposit = Math.round(advance * depMul);
      const electricityReload = Number(form.electricityReload) || 0;
      const accessCardDeposit = cardCount * perCardCost;
      const total = advance + deposit + unitAdminFee + electricityReload + accessCardDeposit;

      const { error: dbErr } = await supabase.from("bookings").insert({
        room_id: form.roomId,
        unit_id: room?.unit_id || null,
        tenant_name: form.tenantName,
        tenant_phone: form.phone,
        tenant_email: form.email,
        tenant_ic_passport: form.icPassport,
        tenant_gender: form.gender,
        tenant_race: form.race,
        tenant_nationality: form.nationality,
        move_in_date: form.moveInDate,
        contract_months: Number(form.tenancyDuration) || 12,
        monthly_salary: Number(form.monthlyRental) || room?.rent || 0,
        occupation: form.occupation,
        pax_staying: Number(form.paxStaying) || 1,
        access_card_count: cardCount,
        emergency_1_name: form.emergency1Name,
        emergency_1_phone: form.emergency1Phone,
        emergency_1_relationship: form.emergency1Relationship,
        emergency_2_name: form.emergency2Name,
        emergency_2_phone: form.emergency2Phone,
        emergency_2_relationship: form.emergency2Relationship,
        parking: form.parkingCount,
        car_plate: form.carPlates.slice(0, Number(form.parkingCount)).filter(p => p.trim()).join(", "),
        submitted_by: form.agentId,
        submitted_by_type: "agent",
        move_in_cost: { advance, deposit, adminFee: unitAdminFee, electricityReload, accessCardDeposit, total },
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
        documents: {
          ...(form.gender === "Couple" || form.gender === "2 Pax" ? {
            tenant2: {
              name: form.tenant2Name, phone: form.tenant2Phone, email: form.tenant2Email,
              icPassport: form.tenant2IcPassport, race: form.tenant2Race,
              nationality: form.tenant2Nationality, occupation: form.tenant2Occupation,
            },
          } : {}),
        },
      });
      if (dbErr) throw dbErr;

      alert("✅ Booking created successfully!");
      setForm(initialForm);
      setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] });
      setShowCreateForm(false);
    } catch (e: any) {
      alert(e.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── CREATE BOOKING FORM ───
  if (showCreateForm) {
    const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
    const unitCfg = selectedRoom ? unitsData.find(u => u.id === selectedRoom.unit_id) : null;
    const depMul = unitCfg?.deposit_multiplier ?? 1.5;
    const unitAdminFee = unitCfg?.admin_fee ?? 330;
    const perCardCost = unitCfg?.access_card_deposit ?? 0;
    const cardCount = Number(form.accessCardCount) || 0;
    const adv = Number(form.advance) || 0;
    const dep = Math.round(adv * depMul);
    const elecReload = Number(form.electricityReload) || 0;
    const accessCardDep = cardCount * perCardCost;
    const total = adv + dep + unitAdminFee + elecReload + accessCardDep;

    return (
      <div className="space-y-6">
        <button onClick={() => setShowCreateForm(false)} className="text-sm text-muted-foreground hover:text-foreground">← Back to Bookings</button>
        <div className="bg-card rounded-lg shadow-lg p-6 space-y-6">
          <div className="text-xl font-bold">Create Booking</div>

          {/* Agent Selection */}
          <div className="space-y-4 border-b border-border pb-6">
            <div className="text-lg font-bold flex items-center gap-2">👤 Agent</div>
            <div className="space-y-1">
              <label className={lbl}>Select Agent *</label>
              <select className={ic + " w-full"} value={form.agentId} onChange={e => set("agentId", e.target.value)}>
                <option value="">— Select Agent —</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name || a.email}{a.name ? ` (${a.email})` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Room Selection */}
          <div className="space-y-4 border-b border-border pb-6">
            <div className="text-lg font-bold flex items-center gap-2">🏠 Room</div>
            <div className="space-y-1">
              <label className={lbl}>Select Room *</label>
              <select className={ic + " w-full"} value={form.roomId} onChange={e => {
                const room = roomsData.find(r => r.id === e.target.value);
                setForm(prev => ({
                  ...prev,
                  roomId: e.target.value,
                  monthlyRental: room ? String(room.rent) : "",
                  advance: room ? String(room.rent) : "",
                }));
              }}>
                <option value="">— Select Room —</option>
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.building} · {r.unit} · {r.room} — RM{r.rent}/mo ({r.room_type})</option>
                ))}
              </select>
            </div>
            {selectedRoom && (
              <div className="bg-primary/10 rounded-lg p-4 text-sm space-y-1">
                <div className="font-semibold">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</div>
                <div>Monthly Rent: <strong>RM{selectedRoom.rent}</strong> · Type: {selectedRoom.room_type} · Unit Type: {selectedRoom.unit_type}</div>
                <div>Max Pax: {selectedRoom.max_pax} · Bed: {selectedRoom.bed_type || "—"}</div>
              </div>
            )}
          </div>

          {/* Tenant Details */}
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2">👤 Tenant Details</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} placeholder="Full Name" value={form.tenantName} onChange={e => set("tenantName", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>NRIC/Passport No *</label><input className={ic} placeholder="NRIC/Passport No" value={form.icPassport} onChange={e => set("icPassport", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" placeholder="Email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} placeholder="Contact No" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Gender *</label>
                <select className={ic} value={form.gender} onChange={e => set("gender", e.target.value)}>
                  <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Couple</option><option>2 Pax</option>
                </select>
              </div>
              <div className="space-y-1"><label className={lbl}>Nationality *</label><input className={ic} placeholder="Nationality" value={form.nationality} onChange={e => set("nationality", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Race *</label><input className={ic} placeholder="Race" value={form.race} onChange={e => set("race", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Move-in Date *</label><input className={ic} type="date" value={form.moveInDate} onChange={e => set("moveInDate", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} placeholder="Occupation" value={form.occupation} onChange={e => set("occupation", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Tenancy Duration (months)</label>
                <select className={ic} value={form.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 6 ? " (half year)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1"><label className={lbl}>Monthly Rental (RM)</label><input className={ic} type="number" placeholder={selectedRoom ? String(selectedRoom.rent) : "0"} value={form.monthlyRental} onChange={e => { set("monthlyRental", e.target.value); set("advance", e.target.value); }} /></div>
              <div className="space-y-1"><label className={lbl}>How many pax staying</label><input className={ic} type="number" placeholder="1" value={form.paxStaying} onChange={e => set("paxStaying", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>How many access card</label><input className={ic} type="number" placeholder="0" value={form.accessCardCount} onChange={e => set("accessCardCount", e.target.value)} /></div>
            </div>

            {/* Second tenant for couple/2pax */}
            {(form.gender === "Couple" || form.gender === "2 Pax") && (
              <div className="mt-4 p-4 border border-dashed border-primary/30 rounded-lg space-y-4">
                <div className="text-base font-bold flex items-center gap-2">👥 Second Tenant Details</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} placeholder="Full Name" value={form.tenant2Name} onChange={e => set("tenant2Name", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>NRIC/Passport No *</label><input className={ic} placeholder="NRIC/Passport No" value={form.tenant2IcPassport} onChange={e => set("tenant2IcPassport", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" placeholder="Email" value={form.tenant2Email} onChange={e => set("tenant2Email", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} placeholder="Contact No" value={form.tenant2Phone} onChange={e => set("tenant2Phone", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Nationality</label><input className={ic} placeholder="Nationality" value={form.tenant2Nationality} onChange={e => set("tenant2Nationality", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Race</label><input className={ic} placeholder="Race" value={form.tenant2Race} onChange={e => set("tenant2Race", e.target.value)} /></div>
                  <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} placeholder="Occupation" value={form.tenant2Occupation} onChange={e => set("tenant2Occupation", e.target.value)} /></div>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Contact 1 */}
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2">🚨 Emergency Contact 1 *</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1"><label className={lbl}>Name *</label><input className={ic} placeholder="Name" value={form.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Phone *</label><input className={ic} placeholder="Phone" value={form.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Relationship *</label><input className={ic} placeholder="e.g. Father, Mother" value={form.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} /></div>
            </div>
          </div>

          {/* Emergency Contact 2 */}
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2">🚨 Emergency Contact 2 *</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1"><label className={lbl}>Name *</label><input className={ic} placeholder="Name" value={form.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Phone *</label><input className={ic} placeholder="Phone" value={form.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} /></div>
              <div className="space-y-1"><label className={lbl}>Relationship *</label><input className={ic} placeholder="e.g. Spouse, Sibling" value={form.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} /></div>
            </div>
          </div>

          {/* Parking */}
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2">🅿️ Parking</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className={lbl}>How many parking</label>
                <select className={ic} value={form.parkingCount} onChange={e => {
                  const count = Number(e.target.value);
                  const plates = [...form.carPlates];
                  while (plates.length < count) plates.push("");
                  setForm(prev => ({ ...prev, parkingCount: e.target.value, carPlates: plates }));
                }}>
                  <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
                </select>
              </div>
              {Array.from({ length: Number(form.parkingCount) }, (_, i) => (
                <div key={i} className="space-y-1"><label className={lbl}>Car Plate {Number(form.parkingCount) > 1 ? i + 1 : ""} *</label>
                  <input className={ic} placeholder={`Car Plate No`} value={form.carPlates[i] || ""} onChange={e => {
                    const plates = [...form.carPlates];
                    plates[i] = e.target.value;
                    setForm(prev => ({ ...prev, carPlates: plates }));
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2">📎 Documents</div>
            <div className="space-y-4">
              {([
                { key: "passport" as const, label: "Passport / IC" },
                { key: "offerLetter" as const, label: "Offer Letter" },
                { key: "transferSlip" as const, label: "Transfer Slip" },
              ]).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className={lbl}>{label}</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                      Choose Files
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => {
                        if (e.target.files) setUploadedFiles(prev => ({ ...prev, [key]: [...prev[key], ...Array.from(e.target.files!)] }));
                      }} />
                    </label>
                    <span className="text-sm text-muted-foreground">{uploadedFiles[key].length > 0 ? uploadedFiles[key].map(f => f.name).join(", ") : "No file chosen"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Move-in Cost */}
          {selectedRoom && (
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">💰 Move-in Cost</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={lbl}>1 Month Advance Rental (RM)</label><input className={ic} type="number" placeholder="0" value={form.advance} onChange={e => set("advance", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Rental Deposit (RM) — ×{depMul}</label><input className={`${ic} bg-muted`} type="number" readOnly value={dep} /></div>
                <div className="space-y-1"><label className={lbl}>Admin Fee (RM)</label><input className={`${ic} bg-muted`} type="number" readOnly value={unitAdminFee} /></div>
                <div className="space-y-1"><label className={lbl}>Electricity Reload (RM)</label><input className={ic} type="number" placeholder="0" value={form.electricityReload} onChange={e => set("electricityReload", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Access Card Deposit — {cardCount} × RM{perCardCost}</label><input className={`${ic} bg-muted`} type="number" readOnly value={accessCardDep} /></div>
              </div>
              <div className="bg-secondary rounded-lg p-4 text-right">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold">RM{total}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button onClick={handleCreateBooking} disabled={submitting} className="bg-primary text-primary-foreground">
              {submitting ? "Submitting..." : "Create Booking"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Booking detail view
  if (selectedBooking) {
    const b = selectedBooking;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedBooking(null)} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Bookings
        </button>
        <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">{b.tenant_name}</div>
            {statusBadge(b.status)}
          </div>
          {b.room && <div className="text-sm text-muted-foreground">{b.room.building} · {b.room.unit} · {b.room.room}</div>}
          <div className="text-xs text-muted-foreground">Booking ID: {b.id.slice(0, 8)}... · Submitted by: {getAgentName(b.submitted_by)}</div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tenant Info</div>
              <div className="text-sm space-y-1">
                <div>📞 {b.tenant_phone}</div>
                <div>✉️ {b.tenant_email || "—"}</div>
                <div>🪪 {b.tenant_ic_passport || "—"}</div>
                <div>👤 {b.tenant_gender || "—"} · {b.tenant_race || "—"} · {b.tenant_nationality || "—"}</div>
                <div>📅 Move-in: {b.move_in_date}</div>
                <div>📝 Contract: {b.contract_months} months</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Work & Details</div>
              <div className="text-sm space-y-1">
                <div>💼 {b.occupation || b.company || "—"}</div>
                <div>💰 RM{b.monthly_salary || "—"}/month</div>
                <div>👥 Pax: {b.pax_staying || "—"}</div>
                <div>🪪 Access Cards: {b.access_card_count || 0}</div>
                <div>🅿️ Parking: {b.parking || "0"} {b.car_plate ? `(${b.car_plate})` : ""}</div>
              </div>
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Emergency Contact 1</div>
              <div className="text-sm space-y-1">
                <div>👤 {b.emergency_name || "—"}</div>
                <div>📞 {b.emergency_phone || "—"}</div>
                <div>🔗 {b.emergency_relationship || "—"}</div>
              </div>
            </div>
          </div>

          {(b.status === "pending" || b.status === "approved") && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              {b.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      await updateBookingStatus.mutateAsync({
                        id: b.id, status: "approved", reviewed_by: user.id,
                        room_id: b.room_id, tenant_name: b.tenant_name,
                        tenant_gender: b.tenant_gender, tenant_race: b.tenant_race,
                        pax_staying: b.pax_staying,
                      });
                      setSelectedBooking(null);
                    }}
                    disabled={updateBookingStatus.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >✅ Approve</Button>
                </div>
              )}
              {b.status === "pending" && (
                <div className="flex gap-2">
                  <Input placeholder="Reject reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="flex-1" />
                  <Button
                    onClick={async () => {
                      if (!user || !rejectReason.trim()) { alert("Please enter a reject reason"); return; }
                      await updateBookingStatus.mutateAsync({ id: b.id, status: "rejected", reviewed_by: user.id, reject_reason: rejectReason });
                      setSelectedBooking(null);
                      setRejectReason("");
                    }}
                    disabled={updateBookingStatus.isPending}
                    variant="destructive"
                  >❌ Reject</Button>
                </div>
              )}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700">
                ⚠️ Booking fee is <strong>non-refundable</strong> once paid. Please confirm with the tenant before cancelling.
              </div>
              <div className="flex gap-2">
                <Input placeholder="Cancel reason (required)..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="flex-1" />
                <Button
                  onClick={async () => {
                    if (!user || !cancelReason.trim()) { alert("Please enter a cancel reason"); return; }
                    if (!confirm("Are you sure you want to cancel this booking? Booking fee is non-refundable.")) return;
                    await updateBookingStatus.mutateAsync({ id: b.id, status: "cancelled" as any, reviewed_by: user.id, reject_reason: cancelReason });
                    setSelectedBooking(null);
                    setCancelReason("");
                  }}
                  disabled={updateBookingStatus.isPending}
                  variant="outline"
                  className="text-gray-500 border-gray-300 hover:bg-gray-100"
                >🚫 Cancel</Button>
              </div>
            </div>
          )}

          {b.status === "rejected" && b.reject_reason && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              <span className="font-semibold">Reject Reason:</span> {b.reject_reason}
            </div>
          )}
          {b.status === "cancelled" && b.reject_reason && (
            <div className="bg-gray-500/10 text-gray-600 rounded-lg p-3 text-sm">
              <span className="font-semibold">Cancel Reason:</span> {b.reject_reason}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Bookings</h2>
        <Button onClick={() => { setForm(initialForm); setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] }); setShowCreateForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Create Booking
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search name, ID, condo..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading bookings...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Condo</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
                    <TableCell>{b.room?.building || "—"}</TableCell>
                    <TableCell className="font-medium">{b.tenant_name}</TableCell>
                    <TableCell className="text-sm">{getAgentName(b.submitted_by)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(b)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(b)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete"
                          onClick={async () => {
                            if (!confirm("Delete this booking?")) return;
                            await supabase.from("bookings").delete().eq("id", b.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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

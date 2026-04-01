import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { useRooms, Room } from "@/hooks/useRooms";
import { useClaims, useCreateClaim, Claim } from "@/hooks/useClaims";
import { useBookings, Booking } from "@/hooks/useBookings";
import { supabase } from "@/integrations/supabase/client";

const rankingData = {
  internal: [
    { rank: 1, name: "Howard", deals: 6 },
    { rank: 2, name: "Simon", deals: 4 },
    { rank: 3, name: "Jun", deals: 3 },
  ],
  external: [
    { rank: 1, name: "Alex", deals: 8 },
    { rank: 2, name: "Aisyah", deals: 5 },
    { rank: 3, name: "Farid", deals: 4 },
  ],
};

const initialBookingForm = {
  tenantName: "", phone: "", email: "", icPassport: "",
  gender: "", race: "", nationality: "", moveInDate: "",
  occupation: "", tenancyDuration: "12", monthlyRental: "",
  paxStaying: "1", accessCardCount: "0",
  emergency1Name: "", emergency1Phone: "", emergency1Relationship: "",
  emergency2Name: "", emergency2Phone: "", emergency2Relationship: "",
  parkingCount: "0", carPlates: [""] as string[],
  selectedCarParks: [] as string[],
  advance: "", deposit: "", adminFee: "", electricityReload: "", accessCardDeposit: "",
};

const rankMedals = ["🥇", "🥈", "🥉"];

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: roomsData = [], isLoading: roomsLoading } = useRooms();
  const { data: claimsData = [] } = useClaims();
  const { data: agentBookings = [] } = useBookings("approved");
  const createClaim = useCreateClaim();
  const [page, setPage] = useState("dashboard");
  const [agentType, setAgentType] = useState("External");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [bookingSubmitted, setBookingSubmitted] = useState<{ room: Room; announcement: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ location: "All", building: "All", price: "All", unitType: "All", roomType: "All" });
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ passport: File[]; offerLetter: File[]; transferSlip: File[] }>({ passport: [], offerLetter: [], transferSlip: [] });
  const [signatureLink, setSignatureLink] = useState<string | null>(null);
  const [signatureToken, setSignatureToken] = useState<string | null>(null);
  const [signatureSigned, setSignatureSigned] = useState(false);
  const [claimForm, setClaimForm] = useState({ bookingId: "", amount: "", description: "", bankName: "", bankAccount: "", accountHolder: "" });
  const [selectedClaimBookings, setSelectedClaimBookings] = useState<string[]>([]);
  const [claimTab, setClaimTab] = useState<"pending" | "approved" | "rejected" | "new">("pending");
  const [checkingSignature, setCheckingSignature] = useState(false);
  const [agentCommissionType, setAgentCommissionType] = useState<string>("internal_basic");
  const [agentCommissionConfig, setAgentCommissionConfig] = useState<any>(null);

  // Fetch agent's commission type & config
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("commission_type, commission_config").eq("user_id", user.id).eq("role", "agent").single()
      .then(({ data }) => {
        if (data?.commission_type) setAgentCommissionType(data.commission_type);
        if (data?.commission_config) setAgentCommissionConfig(data.commission_config);
      });
  }, [user]);

  // Calculate commission based on per-agent config and monthly deals
  const calculateCommission = (booking: Booking) => {
    const rent = booking.monthly_salary || 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyDeals = agentBookings.filter(b => b.submitted_by === user?.id && new Date(b.created_at) >= monthStart).length;
    const config = agentCommissionConfig;

    if (agentCommissionType === "external") {
      const pct = config?.percentage ?? 100;
      return Math.round(rent * pct / 100);
    } else if (agentCommissionType === "internal_full") {
      const tiers = config?.tiers || [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }];
      const tier = tiers.find((t: any) => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      const pct = tier?.percentage ?? 70;
      return Math.round(rent * pct / 100);
    } else {
      // internal_basic
      const tiers = config?.tiers || [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }];
      const tier = tiers.find((t: any) => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      return tier?.amount ?? 200;
    }
  };

  const commissionLabel = (() => {
    const config = agentCommissionConfig;
    if (agentCommissionType === "external") return `External (${config?.percentage ?? 100}%)`;
    if (agentCommissionType === "internal_full") {
      const tiers = config?.tiers || [];
      return `Internal Full — ${tiers.map((t: any) => `${t.percentage}%`).join("/")}`;
    }
    const tiers = config?.tiers || [];
    return `Internal Basic — ${tiers.map((t: any) => `RM${t.amount}`).join("/")}`;
  })();

  const isExternalAgent = agentCommissionType === "external";

  const PRESET_AREAS = [
    "Ara Damansara", "Bandar Saujana Putra", "Bangsar", "Bukit Jalil", "Cheras",
    "Damansara", "Desa Park City", "Eco Cheras", "KL", "KLCC", "Kuala Lumpur",
    "Kuchai Lama", "Old Klang Road", "Pantai", "PJ", "Seri Kembangan",
    "Setapak", "Sri Petaling", "Subang", "Subang Jaya", "USJ",
  ];

  const uniqueLocations = useMemo(() => {
    const locs = new Set([...PRESET_AREAS, ...roomsData.map((r) => r.location).filter(Boolean)]);
    return Array.from(locs).sort();
  }, [roomsData]);

  const uniqueBuildings = useMemo(() => {
    let filtered = roomsData;
    if (filters.location !== "All") filtered = filtered.filter((r) => r.location === filters.location);
    const buildings = new Set(filtered.map((r) => r.building).filter(Boolean));
    return Array.from(buildings).sort();
  }, [roomsData, filters.location]);

  const availableRooms = useMemo(() => {
    return roomsData.filter((room) => {
      if (room.room_type === "Car Park") return false;
      if (room.status !== "Available") return false;
      // External agents cannot see internal-only rooms
      if (isExternalAgent && room.internal_only) return false;
      const keyword = search.trim().toLowerCase();
      const matchesSearch = keyword === "" || room.building.toLowerCase().includes(keyword) || room.unit.toLowerCase().includes(keyword) || room.room.toLowerCase().includes(keyword) || room.location.toLowerCase().includes(keyword);
      const matchesLocation = filters.location === "All" || room.location === filters.location;
      const matchesBuilding = filters.building === "All" || room.building === filters.building;
      const matchesUnitType = filters.unitType === "All" || room.unit_type === filters.unitType;
      const matchesPrice = filters.price === "All" || (filters.price === "Below RM700" && room.rent < 700) || (filters.price === "RM700 - RM900" && room.rent >= 700 && room.rent <= 900) || (filters.price === "Above RM900" && room.rent > 900);
      return matchesSearch && matchesLocation && matchesBuilding && matchesUnitType && matchesPrice;
    });
  }, [search, filters, roomsData]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await lovable.auth.signInWithOAuth("google");
    } catch (e) {
      console.error("Login failed:", e);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const ranking = agentType === "Internal" ? rankingData.internal : rankingData.external;

  const moveInCostText = (room: Room) =>
    `Hi, here is the move-in cost breakdown:\n\n${room.building} ${room.unit} ${room.room}\nMonthly Rent: RM${room.rent}\n• 1 Month Advance: RM${room.move_in_cost.advance}\n• Deposit: RM${room.move_in_cost.deposit}\n• Access Card: RM${room.move_in_cost.accessCard}\n• Move-in Fee: RM${room.move_in_cost.moveInFee}\n\nTotal: RM${room.move_in_cost.total}`;

  const bookingAnnouncement = (room: Room) =>
    `${room.building} ${room.unit} ${room.room} booking received\n${bookingForm.paxStaying} pax ${bookingForm.race} ${bookingForm.gender}`;

  const openRoom = (room: Room) => { setSelectedRoom(room); setPage("detail"); };
  const openBooking = () => {
    setBookingForm(initialBookingForm);
    setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] });
    setSignatureLink(null); setSignatureToken(null); setSignatureSigned(false);
    setPage("booking");
  };

  const validateBooking = () => {
    if (!selectedRoom) return "No room selected.";
    if (selectedRoom.status !== "Available") return "This room is no longer available.";
    const f = bookingForm;
    if (!f.tenantName) return "Please fill in Full Name.";
    if (!f.icPassport) return "Please fill in NRIC/Passport No.";
    if (!f.email) return "Please fill in Email.";
    if (!f.phone) return "Please fill in Contact No.";
    if (!f.gender) return "Please select Gender.";
    if (!f.nationality) return "Please fill in Nationality.";
    if (!f.race) return "Please fill in Race.";
    if (!f.moveInDate) return "Please select Move-in Date.";
    if (!f.occupation) return "Please fill in Occupation.";
    if (!f.tenancyDuration) return "Please fill in Tenancy Duration.";
    if (!f.paxStaying) return "Please fill in Pax Staying.";
    if (!f.emergency1Name || !f.emergency1Phone || !f.emergency1Relationship) return "Please complete Emergency Contact 1.";
    if (!f.emergency2Name || !f.emergency2Phone || !f.emergency2Relationship) return "Please complete Emergency Contact 2.";
    if (Number(f.parkingCount) > 0) {
      const plates = f.carPlates.slice(0, Number(f.parkingCount));
      if (plates.some(p => !p.trim())) return "Please fill in all Car Plate No.";
    }
    if (uploadedFiles.passport.length === 0) return "Please upload Passport / IC.";
    if (uploadedFiles.offerLetter.length === 0) return "Please upload Offer Letter.";
    if (uploadedFiles.transferSlip.length === 0) return "Please upload Transfer Slip.";
    return "";
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("booking-docs").upload(path, file);
    if (error) throw error;
    return path;
  };

  const generateSignatureLink = async () => {
    const error = validateBooking();
    if (error) { alert(error); return; }
    if (!selectedRoom || !user) return;
    setSubmitting(true);
    try {
      const { data, error: err } = await supabase.from("booking_signatures").insert({
        room_id: selectedRoom.id,
        created_by: user.id,
        tenant_name: bookingForm.tenantName,
        booking_data: {
          room: `${selectedRoom.building} ${selectedRoom.unit} ${selectedRoom.room}`,
          rent: selectedRoom.rent,
        },
      }).select("token").single();
      if (err) throw err;
      const link = `${window.location.origin}/sign/${data.token}`;
      setSignatureLink(link);
      setSignatureToken(data.token);
      setSignatureSigned(false);
    } catch (e: any) {
      alert(e.message || "Failed to generate signature link");
    } finally {
      setSubmitting(false);
    }
  };

  const checkSignatureStatus = async () => {
    if (!signatureToken) return;
    setCheckingSignature(true);
    try {
      const { data } = await supabase.from("booking_signatures").select("signed").eq("token", signatureToken).single();
      if (data?.signed) setSignatureSigned(true);
      else alert("Tenant has not signed yet. Please wait.");
    } catch { alert("Failed to check signature status."); }
    finally { setCheckingSignature(false); }
  };

  const submitBooking = async () => {
    if (!signatureSigned) { alert("Tenant must sign before submitting."); return; }
    if (!selectedRoom || !user) return;
    setSubmitting(true);
    try {
      const passportPaths = await Promise.all(uploadedFiles.passport.map(f => uploadFile(f, "passport")));
      const offerPaths = await Promise.all(uploadedFiles.offerLetter.map(f => uploadFile(f, "offer-letter")));
      const slipPaths = await Promise.all(uploadedFiles.transferSlip.map(f => uploadFile(f, "transfer-slip")));

      const advance = Number(bookingForm.advance) || 0;
      const deposit = Number(bookingForm.deposit) || 0;
      const adminFee = Number(bookingForm.adminFee) || 0;
      const electricityReload = Number(bookingForm.electricityReload) || 0;
      const accessCardDeposit = Number(bookingForm.accessCardDeposit) || 0;
      const { error: dbErr } = await supabase.from("bookings").insert({
        room_id: selectedRoom.id,
        unit_id: selectedRoom.unit_id,
        tenant_name: bookingForm.tenantName,
        tenant_phone: bookingForm.phone,
        tenant_email: bookingForm.email,
        tenant_ic_passport: bookingForm.icPassport,
        tenant_gender: bookingForm.gender,
        tenant_race: bookingForm.race,
        tenant_nationality: bookingForm.nationality,
        move_in_date: bookingForm.moveInDate,
        contract_months: Number(bookingForm.tenancyDuration) || 12,
        monthly_salary: Number(bookingForm.monthlyRental) || selectedRoom.rent,
        occupation: bookingForm.occupation,
        pax_staying: Number(bookingForm.paxStaying) || 1,
        access_card_count: Number(bookingForm.accessCardCount) || 0,
        emergency_1_name: bookingForm.emergency1Name,
        emergency_1_phone: bookingForm.emergency1Phone,
        emergency_1_relationship: bookingForm.emergency1Relationship,
        emergency_2_name: bookingForm.emergency2Name,
        emergency_2_phone: bookingForm.emergency2Phone,
        emergency_2_relationship: bookingForm.emergency2Relationship,
        parking: bookingForm.parkingCount,
        car_plate: bookingForm.carPlates.slice(0, Number(bookingForm.parkingCount)).filter(p => p.trim()).join(", "),
        submitted_by: user.id,
        submitted_by_type: "agent",
        move_in_cost: { advance, deposit, adminFee, electricityReload, accessCardDeposit, total: advance + deposit + adminFee + electricityReload + accessCardDeposit },
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
        documents: { carParkIds: bookingForm.selectedCarParks || [] },
      });
      if (dbErr) throw dbErr;

      // Mark selected car parks as Reserved immediately
      if (bookingForm.selectedCarParks && bookingForm.selectedCarParks.length > 0) {
        for (const cpId of bookingForm.selectedCarParks) {
          await supabase.from("rooms").update({ status: "Reserved" } as any).eq("id", cpId);
        }
      }
      setBookingSubmitted({ room: selectedRoom, announcement: bookingAnnouncement(selectedRoom) });
      setPage("booking-success");
    } catch (e: any) {
      alert(e.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── LOGIN ───
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-5xl bg-card rounded-lg shadow-xl grid md:grid-cols-2 overflow-hidden animate-fade-in">
          <div className="bg-primary text-primary-foreground p-10 flex flex-col justify-center">
            <div className="text-4xl font-extrabold tracking-tight">HOMEJOY</div>
            <div className="text-xl mt-3 font-semibold opacity-90">Agent Portal</div>
            <p className="mt-4 opacity-70 leading-relaxed">
              Find available rooms, check unit details, copy move-in cost, submit booking, and manage your claims.
            </p>
          </div>
          <div className="p-10 flex flex-col justify-center gap-4">
            <div className="text-2xl font-bold text-card-foreground">Welcome back</div>
            <p className="text-muted-foreground text-sm -mt-2">Sign in to access your dashboard</p>
            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="px-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {signingIn ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ROOM DETAIL ───
  if (page === "detail" && selectedRoom) {
    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setPage("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dashboard
          </button>
          <div className="bg-card rounded-lg shadow-lg p-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="space-y-6">
              <div>
                <div className="text-3xl font-bold">{selectedRoom.building}</div>
                <div className="text-muted-foreground mt-1">{selectedRoom.unit} • {selectedRoom.room} • RM{selectedRoom.rent}</div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.room_type}</span>
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.unit_type}</span>
                  <span className="px-3 py-1 rounded-md bg-accent text-accent-foreground text-sm font-medium">{selectedRoom.available_date}</span>
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/photos/${selectedRoom.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Photo link copied!");
                  }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  📋 Copy Photo Link
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {(selectedRoom.photos as string[] || []).length > 0 ? (
                  (selectedRoom.photos as string[]).map((path: string, i: number) => (
                    <img key={i} src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos/${path}`} alt={`Room photo ${i + 1}`} className="h-48 w-full object-cover rounded-lg" />
                  ))
                ) : (
                  <div className="h-48 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground font-medium col-span-2">No photos available</div>
                )}
              </div>
              <div className="bg-secondary rounded-lg p-5">
                <div className="text-lg font-semibold">Unit Occupancy</div>
                <div className="mt-3 text-sm space-y-2 text-muted-foreground">
                  <div>Room Max Pax: {selectedRoom.max_pax}</div>
                  <div>Available Pax Left: {selectedRoom.max_pax - selectedRoom.occupied_pax}</div>
                  <div>Unit Max Pax: {selectedRoom.unit_max_pax}</div>
                  <div>Unit Occupied Pax: {selectedRoom.unit_occupied_pax}</div>
                  <div>Unit Balance Pax: {selectedRoom.unit_max_pax - selectedRoom.unit_occupied_pax}</div>
                </div>
                <div className="mt-4 text-sm">
                  <div className="font-medium mb-2 text-foreground">Housemate Summary</div>
                  <div className="space-y-1 text-muted-foreground">
                    {(() => {
                      const unitRooms = roomsData.filter(r => r.unit_id === selectedRoom.unit_id && r.id !== selectedRoom.id && r.status !== "Available");
                      if (unitRooms.length === 0) return <div>No housemates yet</div>;
                      return unitRooms.map(r => (
                        <div key={r.id}>{r.room}: {[r.tenant_gender, r.tenant_race].filter(Boolean).join(", ") || "—"} ({r.pax_staying || 0} pax)</div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="bg-secondary rounded-lg p-5">
                <div className="text-lg font-semibold">Access</div>
                <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof selectedRoom.access_info === 'string' ? selectedRoom.access_info : "No access info"}
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-5">
                <div className="text-lg font-semibold">Move-in Cost</div>
                <div className="mt-3 text-sm space-y-2 text-muted-foreground">
                  <div className="flex justify-between"><span>1 Month Advance</span><span>RM{selectedRoom.move_in_cost.advance}</span></div>
                  <div className="flex justify-between"><span>Deposit</span><span>RM{selectedRoom.move_in_cost.deposit}</span></div>
                  <div className="flex justify-between"><span>Access Card</span><span>RM{selectedRoom.move_in_cost.accessCard}</span></div>
                  <div className="flex justify-between"><span>Move-in Fee</span><span>RM{selectedRoom.move_in_cost.moveInFee}</span></div>
                  <div className="pt-2 border-t flex justify-between font-semibold text-foreground"><span>Total</span><span>RM{selectedRoom.move_in_cost.total}</span></div>
                </div>
                <div className="mt-4 rounded-md bg-card border p-3 text-xs whitespace-pre-wrap text-muted-foreground">{moveInCostText(selectedRoom)}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(moveInCostText(selectedRoom))}
                  className="mt-4 px-4 py-3 rounded-lg border w-full text-foreground hover:bg-secondary transition-colors font-medium"
                >
                  Copy for Tenant
                </button>
              </div>
              <button onClick={openBooking} className="w-full px-4 py-4 rounded-lg bg-cyan-500 text-white font-semibold text-base hover:bg-cyan-600 transition-colors">
                Book Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── BOOKING FORM ───
  if (page === "booking" && selectedRoom) {
    const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
    const f = bookingForm;
    const set = (field: string, value: string) => setBookingForm({ ...f, [field]: value });

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setPage("detail")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Room Detail</button>
          <div className="bg-card rounded-lg shadow-lg p-6 space-y-6">
            {/* Header */}
            <div className="bg-primary/10 rounded-lg p-5 text-center space-y-1">
              <div className="text-lg font-bold text-primary">Thanks for trusting us and welcome you to join us! 🥳🥳</div>
              <div className="text-sm text-muted-foreground">{selectedRoom.building} · {selectedRoom.unit} · {selectedRoom.room}</div>
              <div className="text-sm font-semibold">Monthly Rent: RM{selectedRoom.rent}</div>
            </div>

            {/* Tenant Details */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">👤 Tenant Details</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} placeholder="Full Name" value={f.tenantName} onChange={e => set("tenantName", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>NRIC/Passport No *</label><input className={ic} placeholder="NRIC/Passport No" value={f.icPassport} onChange={e => set("icPassport", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Email *</label><input className={ic} type="email" placeholder="Email" value={f.email} onChange={e => set("email", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} placeholder="Contact No" value={f.phone} onChange={e => set("phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Gender *</label>
                  <select className={ic} value={f.gender} onChange={e => set("gender", e.target.value)}>
                    <option value="">Select Gender</option><option>Male</option><option>Female</option>
                  </select>
                </div>
                <div className="space-y-1"><label className={lbl}>Nationality *</label><input className={ic} placeholder="Nationality" value={f.nationality} onChange={e => set("nationality", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Race *</label><input className={ic} placeholder="Race" value={f.race} onChange={e => set("race", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Move-in Date *</label><input className={ic} type="date" value={f.moveInDate} onChange={e => set("moveInDate", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Occupation *</label><input className={ic} placeholder="Occupation" value={f.occupation} onChange={e => set("occupation", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Tenancy Duration (months) *</label><input className={ic} type="number" placeholder="12" value={f.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Monthly Rental (RM)</label><input className={ic} type="number" placeholder={String(selectedRoom.rent)} value={f.monthlyRental} onChange={e => set("monthlyRental", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>How many pax staying *</label><input className={ic} type="number" placeholder="1" value={f.paxStaying} onChange={e => set("paxStaying", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>How many access card</label><input className={ic} type="number" placeholder="0" value={f.accessCardCount} onChange={e => set("accessCardCount", e.target.value)} /></div>
              </div>
            </div>

            {/* Emergency Contact 1 */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">🚨 Emergency Contact 1 *</div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1"><label className={lbl}>Name *</label><input className={ic} placeholder="Name" value={f.emergency1Name} onChange={e => set("emergency1Name", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Phone *</label><input className={ic} placeholder="Phone" value={f.emergency1Phone} onChange={e => set("emergency1Phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Relationship *</label><input className={ic} placeholder="e.g. Father, Mother" value={f.emergency1Relationship} onChange={e => set("emergency1Relationship", e.target.value)} /></div>
              </div>
            </div>

            {/* Emergency Contact 2 */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">🚨 Emergency Contact 2 *</div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1"><label className={lbl}>Name *</label><input className={ic} placeholder="Name" value={f.emergency2Name} onChange={e => set("emergency2Name", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Phone *</label><input className={ic} placeholder="Phone" value={f.emergency2Phone} onChange={e => set("emergency2Phone", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Relationship *</label><input className={ic} placeholder="e.g. Spouse, Sibling" value={f.emergency2Relationship} onChange={e => set("emergency2Relationship", e.target.value)} /></div>
              </div>
            </div>

            {/* Parking & Car Park */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">🅿️ Parking</div>
              {(() => {
                const availableCarParks = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available" && r.building === selectedRoom.building);
                return availableCarParks.length > 0 ? (
                  <div className="bg-accent/10 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-semibold">Available Car Parks at {selectedRoom.building}</div>
                    <div className="space-y-2">
                      {availableCarParks.map(cp => (
                        <label key={cp.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.selectedCarParks?.includes(cp.id) || false}
                            onChange={(e) => {
                              const current = f.selectedCarParks || [];
                              const updated = e.target.checked ? [...current, cp.id] : current.filter((id: string) => id !== cp.id);
                              setBookingForm({ ...f, selectedCarParks: updated });
                            }}
                            className="w-4 h-4 rounded border-muted-foreground"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{cp.room}</span>
                            {cp.bed_type && <span className="text-muted-foreground ml-2">Lot: {cp.bed_type}</span>}
                          </div>
                          <span className="font-semibold">RM{cp.rent}/mo</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={lbl}>How many parking</label>
                  <select className={ic} value={f.parkingCount} onChange={e => {
                    const count = Number(e.target.value);
                    const plates = [...f.carPlates];
                    while (plates.length < count) plates.push("");
                    setBookingForm({ ...f, parkingCount: e.target.value, carPlates: plates });
                  }}>
                    <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
                  </select>
                </div>
                {Array.from({ length: Number(f.parkingCount) }, (_, i) => (
                  <div key={i} className="space-y-1"><label className={lbl}>Car Plate {Number(f.parkingCount) > 1 ? i + 1 : ""} *</label>
                    <input className={ic} placeholder={`Car Plate No ${Number(f.parkingCount) > 1 ? i + 1 : ""}`} value={f.carPlates[i] || ""} onChange={e => {
                      const plates = [...f.carPlates];
                      plates[i] = e.target.value;
                      setBookingForm({ ...f, carPlates: plates });
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Document Uploads */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">📎 Documents</div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={lbl}>Passport / IC *</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                      Choose Files
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => { if (e.target.files) setUploadedFiles(prev => ({ ...prev, passport: [...prev.passport, ...Array.from(e.target.files!)] })); }} />
                    </label>
                    <span className="text-sm text-muted-foreground">{uploadedFiles.passport.length > 0 ? uploadedFiles.passport.map(f => f.name).join(", ") : "No file chosen"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Offer Letter *</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                      Choose Files
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => { if (e.target.files) setUploadedFiles(prev => ({ ...prev, offerLetter: [...prev.offerLetter, ...Array.from(e.target.files!)] })); }} />
                    </label>
                    <span className="text-sm text-muted-foreground">{uploadedFiles.offerLetter.length > 0 ? uploadedFiles.offerLetter.map(f => f.name).join(", ") : "No file chosen"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Transfer Slip *</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity">
                      Choose Files
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => { if (e.target.files) setUploadedFiles(prev => ({ ...prev, transferSlip: [...prev.transferSlip, ...Array.from(e.target.files!)] })); }} />
                    </label>
                    <span className="text-sm text-muted-foreground">{uploadedFiles.transferSlip.length > 0 ? uploadedFiles.transferSlip.map(f => f.name).join(", ") : "No file chosen"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Move-in Cost */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">💰 Move-in Cost</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={lbl}>1 Month Advance Rental (RM)</label><input className={ic} type="number" placeholder="0" value={f.advance} onChange={e => set("advance", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Rental Deposit (RM)</label><input className={ic} type="number" placeholder="0" value={f.deposit} onChange={e => set("deposit", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Admin Fee (RM)</label><input className={ic} type="number" placeholder="0" value={f.adminFee} onChange={e => set("adminFee", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Electricity Reload (RM)</label><input className={ic} type="number" placeholder="0" value={f.electricityReload} onChange={e => set("electricityReload", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Access Card Deposit (RM)</label><input className={ic} type="number" placeholder="0" value={f.accessCardDeposit} onChange={e => set("accessCardDeposit", e.target.value)} /></div>
              </div>
              <div className="bg-secondary rounded-lg p-4 text-right">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold">RM{(Number(f.advance) || 0) + (Number(f.deposit) || 0) + (Number(f.adminFee) || 0) + (Number(f.electricityReload) || 0) + (Number(f.accessCardDeposit) || 0)}</span>
              </div>
            </div>

            {/* Tenant Signature */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">✍️ Tenant Signature</div>
              {!signatureLink ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Generate a signature link to send to the tenant. They must sign to acknowledge that the booking fee is non-refundable.</div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setPage("detail")} className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
                    <button onClick={generateSignatureLink} disabled={submitting} className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                      {submitting ? "Generating..." : "Generate Signature Link"}
                    </button>
                  </div>
                </div>
              ) : !signatureSigned ? (
                <div className="space-y-3">
                  <div className="bg-secondary rounded-lg p-4 space-y-2">
                    <div className="text-sm font-medium">Send this link to the tenant:</div>
                    <div className="flex gap-2">
                      <input className="flex-1 px-3 py-2 rounded-lg border bg-background text-foreground text-sm" readOnly value={signatureLink} />
                      <button onClick={() => navigator.clipboard.writeText(signatureLink)} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-80 transition-opacity border">Copy</button>
                    </div>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-sm text-destructive">⏳ Waiting for tenant to sign...</div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setPage("detail")} className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
                    <button onClick={checkSignatureStatus} disabled={checkingSignature} className="px-5 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                      {checkingSignature ? "Checking..." : "Check Signature Status"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-accent/20 rounded-lg p-3 text-sm text-accent-foreground font-medium">✅ Tenant has signed! You can now submit the booking.</div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setPage("detail")} className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
                    <button onClick={submitBooking} disabled={submitting} className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                      {submitting ? "Submitting..." : "Submit Booking"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── BOOKING SUCCESS ───
  if (page === "booking-success" && bookingSubmitted) {
    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-3xl mx-auto bg-card rounded-lg shadow-lg p-8 space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-2xl font-bold">Booking Submitted</div>
            <div className="text-muted-foreground mt-1">The room is now pending admin approval.</div>
          </div>
          <div className="rounded-lg bg-secondary p-5">
            <div className="text-sm text-muted-foreground mb-2">Copy to WhatsApp Group</div>
            <div className="whitespace-pre-wrap text-sm text-foreground">{bookingSubmitted.announcement}</div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigator.clipboard.writeText(bookingSubmitted.announcement)}
              className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium"
            >
              Copy to WhatsApp
            </button>
            <button onClick={() => setPage("dashboard")} className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CLAIMS PAGE ───
  if (page === "claims") {
    const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
    const pendingClaims = claimsData.filter(c => c.status === "pending");
    const approvedClaims = claimsData.filter(c => c.status === "approved");
    const rejectedClaims = claimsData.filter(c => c.status === "rejected");
    const totalPending = pendingClaims.reduce((s, c) => s + Number(c.amount), 0);
    const totalApproved = approvedClaims.reduce((s, c) => s + Number(c.amount), 0);

    const submitClaim = async () => {
      if (!user) return;
      if (selectedClaimBookings.length === 0) { alert("Please select at least one booking."); return; }
      if (!claimForm.amount || !claimForm.description) { alert("Please fill in amount and description."); return; }
      try {
        await createClaim.mutateAsync({
          agent_id: user.id,
          booking_id: selectedClaimBookings.length === 1 ? selectedClaimBookings[0] : null,
          amount: Number(claimForm.amount),
          description: claimForm.description,
          bank_name: claimForm.bankName,
          bank_account: claimForm.bankAccount,
          account_holder: claimForm.accountHolder,
        });
        setClaimForm({ bookingId: "", amount: "", description: "", bankName: "", bankAccount: "", accountHolder: "" });
        setSelectedClaimBookings([]);
        setClaimTab("pending");
      } catch (e: any) {
        alert(e.message || "Failed to submit claim");
      }
    };

    // Filter approved bookings submitted by this agent that don't already have a claim
    const claimedBookingIds = new Set(claimsData.map(c => c.booking_id).filter(Boolean));
    const availableBookings = agentBookings.filter(b => b.submitted_by === user?.id && !claimedBookingIds.has(b.id));

    const renderClaimList = (claims: Claim[]) => {
      if (claims.length === 0) return <div className="text-center py-8 text-muted-foreground">No claims</div>;
      return (
        <div className="space-y-3">
          {claims.map(c => {
            const linkedBooking = agentBookings.find(b => b.id === c.booking_id);
            return (
              <div key={c.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">RM{Number(c.amount).toLocaleString()}</div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.status === "pending" ? "bg-yellow-500/20 text-yellow-600" : c.status === "approved" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>{c.status.toUpperCase()}</span>
                </div>
                {linkedBooking && (
                  <div className="text-xs bg-secondary rounded-lg px-3 py-2 text-muted-foreground">
                    📋 {linkedBooking.room?.building} {linkedBooking.room?.unit} {linkedBooking.room?.room} — {linkedBooking.tenant_name}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">{c.description}</div>
                {c.bank_name && <div className="text-xs text-muted-foreground">Bank: {c.bank_name} · {c.bank_account} · {c.account_holder}</div>}
                {c.reject_reason && <div className="text-xs text-destructive">Reason: {c.reject_reason}</div>}
                <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setPage("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Dashboard</button>
          <div className="text-3xl font-extrabold tracking-tight">💰 Claims</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-lg shadow-sm p-5 text-center">
              <div className="text-2xl font-extrabold text-yellow-600">RM{totalPending.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">Pending</div>
            </div>
            <div className="bg-card rounded-lg shadow-sm p-5 text-center">
              <div className="text-2xl font-extrabold text-green-600">RM{totalApproved.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">Approved</div>
            </div>
            <div className="bg-card rounded-lg shadow-sm p-5 text-center">
              <div className="text-2xl font-extrabold">{claimsData.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Claims</div>
            </div>
          </div>
          <div className="flex gap-2">
            {(["new", "pending", "approved", "rejected"] as const).map(t => (
              <button key={t} onClick={() => setClaimTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${claimTab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}>
                {t === "new" ? "+ New Claim" : `${t.charAt(0).toUpperCase() + t.slice(1)} (${t === "pending" ? pendingClaims.length : t === "approved" ? approvedClaims.length : rejectedClaims.length})`}
              </button>
            ))}
          </div>
          {claimTab === "new" && (
            <div className="bg-card rounded-lg shadow-sm p-6 space-y-5">
              <div className="text-lg font-bold">Submit New Claim</div>
              {/* Booking selector */}
              <div className="space-y-1">
                <label className={lbl}>Select Bookings (Approved) *</label>
                <div className="text-xs text-muted-foreground mb-1">Your commission tier: <span className="font-semibold">{commissionLabel}</span></div>
                {availableBookings.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-secondary rounded-lg p-4">No approved bookings available for claim. Claims can only be submitted for approved bookings that haven't been claimed yet.</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-secondary/30">
                    {availableBookings.length > 1 && (
                      <label className="flex items-center gap-2 pb-2 border-b border-border text-sm cursor-pointer">
                        <input type="checkbox" checked={selectedClaimBookings.length === availableBookings.length} onChange={e => {
                          if (e.target.checked) {
                            const allIds = availableBookings.map(b => b.id);
                            setSelectedClaimBookings(allIds);
                            const totalAmount = availableBookings.reduce((s, b) => s + calculateCommission(b), 0);
                            const desc = availableBookings.map(b => `${b.room?.building || ""} ${b.room?.unit || ""} ${b.room?.room || ""} (${b.tenant_name})`).join(", ");
                            setClaimForm({ ...claimForm, amount: String(totalAmount), description: `Commission - ${desc}` });
                          } else {
                            setSelectedClaimBookings([]);
                            setClaimForm({ ...claimForm, amount: "", description: "" });
                          }
                        }} className="w-4 h-4 rounded" />
                        <span className="font-medium">Select All ({availableBookings.length})</span>
                      </label>
                    )}
                    {availableBookings.map(b => {
                      const isChecked = selectedClaimBookings.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 rounded p-1 transition-colors">
                          <input type="checkbox" checked={isChecked} onChange={() => {
                            const next = isChecked ? selectedClaimBookings.filter(id => id !== b.id) : [...selectedClaimBookings, b.id];
                            setSelectedClaimBookings(next);
                            const selectedBookings = availableBookings.filter(ab => next.includes(ab.id));
                            const totalAmount = selectedBookings.reduce((s, sb) => s + calculateCommission(sb), 0);
                            const desc = selectedBookings.map(sb => `${sb.room?.building || ""} ${sb.room?.unit || ""} ${sb.room?.room || ""} (${sb.tenant_name})`).join(", ");
                            setClaimForm({ ...claimForm, amount: totalAmount ? String(totalAmount) : "", description: selectedBookings.length ? `Commission - ${desc}` : "" });
                          }} className="w-4 h-4 rounded" />
                          <span>{b.room?.building} {b.room?.unit} {b.room?.room} — {b.tenant_name} ({new Date(b.move_in_date).toLocaleDateString()}) · <span className="font-semibold text-primary">RM{calculateCommission(b)}</span></span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedClaimBookings.length > 0 && (
                  <div className="text-sm font-medium text-primary mt-1">
                    {selectedClaimBookings.length} booking(s) selected · Total: RM{claimForm.amount}
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={lbl}>Amount (RM) *</label><input className={ic} type="number" placeholder="e.g. 500" value={claimForm.amount} onChange={e => setClaimForm({ ...claimForm, amount: e.target.value })} /></div>
                <div className="space-y-1"><label className={lbl}>Description *</label><input className={ic} placeholder="e.g. Commission for Casa Tiara A-17-8" value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} /></div>
                <div className="space-y-1"><label className={lbl}>Bank Name</label><input className={ic} placeholder="e.g. Maybank" value={claimForm.bankName} onChange={e => setClaimForm({ ...claimForm, bankName: e.target.value })} /></div>
                <div className="space-y-1"><label className={lbl}>Account No</label><input className={ic} placeholder="Bank account number" value={claimForm.bankAccount} onChange={e => setClaimForm({ ...claimForm, bankAccount: e.target.value })} /></div>
                <div className="space-y-1"><label className={lbl}>Account Holder</label><input className={ic} placeholder="Account holder name" value={claimForm.accountHolder} onChange={e => setClaimForm({ ...claimForm, accountHolder: e.target.value })} /></div>
              </div>
              <div className="flex justify-end">
                <button onClick={submitClaim} disabled={createClaim.isPending || selectedClaimBookings.length === 0} className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {createClaim.isPending ? "Submitting..." : `Submit Claim (${selectedClaimBookings.length} booking${selectedClaimBookings.length > 1 ? "s" : ""})`}
                </button>
              </div>
            </div>
          )}
          {claimTab === "pending" && renderClaimList(pendingClaims)}
          {claimTab === "approved" && renderClaimList(approvedClaims)}
          {claimTab === "rejected" && renderClaimList(rejectedClaims)}
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ───
  const availableCarParksCount = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available").length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyDeals = agentBookings.filter(b => b.submitted_by === user?.id && new Date(b.created_at) >= monthStart).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-extrabold tracking-tight text-primary">HOMEJOY</div>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">{role ?? "agent"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>
            {role === "admin" && (
              <button onClick={() => navigate("/admin")} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-80 transition-opacity">
                Admin Panel
              </button>
            )}
            <button onClick={signOut} className="px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl shadow-sm p-5 border">
            <div className="text-3xl font-extrabold text-primary">{roomsData.filter(r => r.room_type !== "Car Park" && r.status === "Available").length}</div>
            <div className="text-xs font-medium text-muted-foreground mt-1">Available Rooms</div>
          </div>
          <div className="bg-card rounded-xl shadow-sm p-5 border">
            <div className="text-3xl font-extrabold text-accent">{availableCarParksCount}</div>
            <div className="text-xs font-medium text-muted-foreground mt-1">Available Car Parks</div>
          </div>
          <div className="bg-card rounded-xl shadow-sm p-5 border">
            <div className="text-3xl font-extrabold">{monthlyDeals}</div>
            <div className="text-xs font-medium text-muted-foreground mt-1">My Deals (This Month)</div>
          </div>
          <button onClick={() => setPage("claims")} className="bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-sm p-5 text-left hover:shadow-md transition-shadow">
            <div className="text-3xl font-extrabold text-primary-foreground">💰</div>
            <div className="text-xs font-medium text-primary-foreground/80 mt-1">View Claims</div>
          </button>
        </div>

        {/* Commission Info */}
        <div className="bg-card rounded-xl shadow-sm p-4 border flex items-center justify-between">
          <div className="text-sm"><span className="text-muted-foreground">Your commission tier:</span> <span className="font-semibold">{commissionLabel}</span></div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Room Listings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold">Available Units</div>
              <span className="text-sm text-muted-foreground">{availableRooms.length} rooms</span>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border p-4">
              <div className="grid md:grid-cols-5 gap-3">
                <input className="px-3 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">Area</label>
                  <select className="px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value, building: "All" })}>
                    <option>All</option>{uniqueLocations.map((loc) => <option key={loc}>{loc}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">Property</label>
                  <select className="px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" value={filters.building} onChange={(e) => setFilters({ ...filters, building: e.target.value })}>
                    <option>All</option>{uniqueBuildings.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">Price</label>
                  <select className="px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" value={filters.price} onChange={(e) => setFilters({ ...filters, price: e.target.value })}>
                    <option>All</option><option>Below RM700</option><option>RM700 - RM900</option><option>Above RM900</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">Gender</label>
                  <select className="px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" value={filters.unitType} onChange={(e) => setFilters({ ...filters, unitType: e.target.value })}>
                    <option>All</option><option>Female Unit</option><option>Mix Unit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Room Cards */}
            {roomsLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading rooms...</div>
            ) : availableRooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">No rooms match your filters</div>
            ) : (
              <div className="space-y-3">
                {availableRooms.map((room) => {
                  const buildingCarParks = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available" && r.building === room.building).length;
                  return (
                    <div key={room.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition-all hover:border-primary/30 group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold">{room.building}</div>
                            <span className="text-sm text-muted-foreground">{room.unit}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">{room.room} — <span className="font-bold text-primary text-lg">RM{room.rent}</span><span className="text-xs text-muted-foreground">/mo</span></div>
                          <div className="flex gap-1.5 flex-wrap mt-2.5">
                            <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium">{room.room_type}</span>
                            <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium">{room.unit_type}</span>
                            <span className="px-2.5 py-1 rounded-md bg-accent/20 text-accent-foreground text-xs font-medium">{room.available_date}</span>
                            {buildingCarParks > 0 && <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">🅿️ {buildingCarParks} car park{buildingCarParks > 1 ? "s" : ""}</span>}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                            <span>Max: {room.unit_max_pax}</span>
                            <span>Occupied: {room.unit_occupied_pax}</span>
                            <span className="font-semibold text-foreground">Balance: {room.unit_max_pax - room.unit_occupied_pax}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button onClick={() => openRoom(room)} className="px-4 py-2 rounded-lg border text-foreground hover:bg-secondary transition-colors text-sm font-medium">Details</button>
                          <button onClick={() => { setSelectedRoom(room); openBooking(); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">Book</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl shadow-sm border p-5">
              <div className="text-sm font-bold mb-3">🏆 Top Agents</div>
              <div className="flex gap-1 mb-3">
                <button onClick={() => setAgentType("Internal")} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${agentType === "Internal" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>Internal</button>
                <button onClick={() => setAgentType("External")} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${agentType === "External" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>External</button>
              </div>
              <div className="space-y-2">
                {ranking.map((item, i) => (
                  <div key={item.rank} className="rounded-lg bg-secondary/60 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{rankMedals[i]}</span>
                      <div>
                        <div className="font-semibold text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.deals} deals</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import { useRooms, useUnits, Room } from "@/hooks/useRooms";
import { useClaims, useCreateClaim, Claim } from "@/hooks/useClaims";
import { useBookings, useUpdateBookingStatus, Booking } from "@/hooks/useBookings";
import { AgentBookingsContent } from "@/components/AgentBookingsContent";
import { supabase } from "@/integrations/supabase/client";
import { OldDashboardLayout } from "@/components/OldDashboardLayout";
import { AdminContent } from "@/components/AdminContent";
import { LocationsContent } from "@/components/LocationsContent";
import { CondosContent } from "@/components/CondosContent";
import { BuildingForm } from "@/components/BuildingForm";
import { RoomsContent } from "@/components/RoomsContent";
import { TenantsContent } from "@/components/TenantsContent";
import { MoveInContent } from "@/components/MoveInContent";
import { BookingsContent } from "@/components/BookingsContent";
import { AdminDashboardContent } from "@/components/AdminDashboardContent";
import { Condo } from "@/hooks/useCondos";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  tenant2Name: "", tenant2Phone: "", tenant2Email: "", tenant2IcPassport: "",
  tenant2Race: "", tenant2Nationality: "", tenant2Occupation: "",
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
  const location = useLocation();
  const { data: roomsData = [], isLoading: roomsLoading } = useRooms();
  const { data: unitsData = [] } = useUnits();
  const { data: claimsData = [] } = useClaims();
  const { data: agentBookings = [] } = useBookings("approved");
  const { data: allBookings = [] } = useBookings();
  const createClaim = useCreateClaim();
  const [page, setPage] = useState(() => {
    const navState = location.state as { page?: string } | null;
    return navState?.page || "dashboard";
  });
  const isAdmin = role === "admin" || role === "boss" || role === "manager";
  const [adminTab, setAdminTab] = useState<string>(() => {
    const navState = location.state as { adminTab?: string } | null;
    return navState?.adminTab || "dashboard";
  });
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingFormOpen, setBuildingFormOpen] = useState(false);
  const [buildingFormData, setBuildingFormData] = useState<Condo | undefined>(undefined);
  const [agentType, setAgentType] = useState("External");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [bookingSubmitted, setBookingSubmitted] = useState<{ room: Room; announcement: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ location: "All", building: "All", price: "All", unitType: "All", roomType: "All" });
  const [signingIn, setSigningIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
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
  const [overviewPeriod, setOverviewPeriod] = useState<string>(String(new Date().getMonth()));
  const [overviewYear, setOverviewYear] = useState<number>(new Date().getFullYear());

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
    const duration = booking.contract_months || 12;
    const durationMultiplier = duration / 12;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyDeals = agentBookings.filter(b => b.submitted_by === user?.id && new Date(b.created_at) >= monthStart).length;
    const config = agentCommissionConfig;

    let base = 0;
    if (agentCommissionType === "external") {
      const pct = config?.percentage ?? 100;
      base = Math.round(rent * pct / 100);
    } else if (agentCommissionType === "internal_full") {
      const tiers = config?.tiers || [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }];
      const tier = tiers.find((t: any) => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      const pct = tier?.percentage ?? 70;
      base = Math.round(rent * pct / 100);
    } else {
      // internal_basic
      const tiers = config?.tiers || [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }];
      const tier = tiers.find((t: any) => monthlyDeals >= t.min && (t.max === null || monthlyDeals <= t.max));
      base = tier?.amount ?? 200;
    }
    return Math.round(base * durationMultiplier);
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
      if (room.status !== "Available" && room.status !== "Available Soon") return false;
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

  // Group available rooms by building
  const buildingSummary = useMemo(() => {
    const allAvailable = roomsData.filter(r => {
      if (r.room_type === "Car Park") return false;
      if (r.status !== "Available" && r.status !== "Available Soon") return false;
      if (isExternalAgent && r.internal_only) return false;
      return true;
    });
    const map = new Map<string, { building: string; location: string; count: number; soonCount: number; minRent: number; maxRent: number; carParks: number; unitTypes: Set<string> }>();
    for (const room of allAvailable) {
      const existing = map.get(room.building);
      const isSoon = room.status === "Available Soon";
      if (existing) {
        existing.count++;
        if (isSoon) existing.soonCount++;
        existing.minRent = Math.min(existing.minRent, room.rent);
        existing.maxRent = Math.max(existing.maxRent, room.rent);
        existing.unitTypes.add(room.unit_type);
      } else {
        map.set(room.building, {
          building: room.building,
          location: room.location,
          count: 1,
          soonCount: isSoon ? 1 : 0,
          minRent: room.rent,
          maxRent: room.rent,
          carParks: 0,
          unitTypes: new Set([room.unit_type]),
        });
      }
    }
    for (const r of roomsData) {
      if (r.room_type === "Car Park" && r.status === "Available" && map.has(r.building)) {
        map.get(r.building)!.carParks++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [roomsData, isExternalAgent]);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Please enter email and password");
      return;
    }
    setSigningIn(true);
    setLoginError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });
      if (error) throw error;
    } catch (e: any) {
      setLoginError(e.message || "Login failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setForgotMsg("Please enter your email"); return; }
    setForgotSending(true);
    setForgotMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotMsg("✅ Reset link sent! Check your email.");
    } catch (e: any) {
      setForgotMsg(e.message || "Failed to send reset email");
    } finally {
      setForgotSending(false);
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
    if (selectedRoom.status !== "Available") return "This room is not available for booking yet.";
    const f = bookingForm;
    if (!f.tenantName) return "Please fill in Full Name.";
    if (!f.icPassport) return "Please fill in NRIC/Passport No.";
    if (!f.email) return "Please fill in Email.";
    if (!f.phone) return "Please fill in Contact No.";
    if (!f.gender) return "Please select Gender.";
    if (f.gender === "Couple" || f.gender === "2 Pax") {
      if (!f.tenant2Name) return "Please fill in Second Tenant Full Name.";
      if (!f.tenant2IcPassport) return "Please fill in Second Tenant NRIC/Passport No.";
      if (!f.tenant2Phone) return "Please fill in Second Tenant Contact No.";
    }
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

      // Upload ANPR car photos if applicable
      const carPhotoPaths: Record<string, string> = {};
      const unitConfig = unitsData.find(u => u.id === selectedRoom.unit_id);
      const parkingType = (unitConfig as any)?.parking_type || "None";
      if (parkingType === "ANPR" && Number(bookingForm.parkingCount) > 0) {
        for (let i = 0; i < Number(bookingForm.parkingCount); i++) {
          const frontFile = (uploadedFiles as any)[`carFront_${i}`];
          const backFile = (uploadedFiles as any)[`carBack_${i}`];
          if (frontFile) carPhotoPaths[`car_${i}_front`] = await uploadFile(frontFile, "car-photo");
          if (backFile) carPhotoPaths[`car_${i}_back`] = await uploadFile(backFile, "car-photo");
        }
      }

      const depositMultiplier = unitConfig?.deposit_multiplier ?? 1.5;
      const unitAdminFee = unitConfig?.admin_fee ?? 330;
      const perCardCost = unitConfig?.access_card_deposit ?? 0;
      const cardCount = Number(bookingForm.accessCardCount) || 0;
      const advance = Number(bookingForm.advance) || 0;
      const deposit = Math.round(advance * depositMultiplier);
      const adminFee = unitAdminFee;
      const electricityReload = Number(bookingForm.electricityReload) || 0;
      const accessCardDeposit = cardCount * perCardCost;
      const parkingCardCost = (unitConfig as any)?.parking_card_deposit || 0;
      const parkingCount = Number(bookingForm.parkingCount) || 0;
      const parkingCardDeposit = parkingType === "Access Card" ? parkingCount * parkingCardCost : 0;
      const total = advance + deposit + adminFee + electricityReload + accessCardDeposit + parkingCardDeposit;
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
        move_in_cost: { advance, deposit, adminFee, electricityReload, accessCardDeposit, parkingCardDeposit, total },
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
        documents: {
          carParkIds: bookingForm.selectedCarParks || [],
          carPhotos: carPhotoPaths,
          parkingType,
          ...(bookingForm.gender === "Couple" || bookingForm.gender === "2 Pax" ? {
            tenant2: {
              name: bookingForm.tenant2Name,
              phone: bookingForm.tenant2Phone,
              email: bookingForm.tenant2Email,
              icPassport: bookingForm.tenant2IcPassport,
              race: bookingForm.tenant2Race,
              nationality: bookingForm.tenant2Nationality,
              occupation: bookingForm.tenant2Occupation,
            },
          } : {}),
        },
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

  // ─── LOGIN REDIRECT ───
  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }

  // ─── ROOM DETAIL ───
  if (page === "detail" && selectedRoom) {
    return (
      <OldDashboardLayout>
        <div className="flex-1 p-6 overflow-auto text-foreground">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => selectedBuilding ? setPage("building") : setPage("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </button>
          <div className="bg-card rounded-lg shadow-lg p-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="space-y-6">
              <div>
                <div className="text-3xl font-bold">{selectedRoom.building}</div>
                <div className="text-muted-foreground mt-1">{selectedRoom.unit} • {selectedRoom.room} • RM{selectedRoom.rent}</div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.room_type}</span>
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.unit_type}</span>
                  <span className={`px-3 py-1 rounded-md text-sm font-medium ${selectedRoom.status === "Available Soon" ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"}`}>{selectedRoom.status === "Available Soon" ? `🕐 Available ${selectedRoom.available_date}` : selectedRoom.available_date}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/photos/${selectedRoom.id}`;
                      navigator.clipboard.writeText(url);
                      alert("Photo link copied!");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    📋 Copy Photo Link
                  </button>
                  {selectedRoom.unit_id && (
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/common/${selectedRoom.unit_id}`;
                        navigator.clipboard.writeText(url);
                        alert("Common area link copied!");
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      🏠 Copy Common Area Link
                    </button>
                  )}
                </div>
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
              {selectedRoom.status === "Available Soon" ? (
                <div className="w-full px-4 py-4 rounded-lg bg-muted text-muted-foreground font-semibold text-base text-center">
                  🕐 Available Soon — {selectedRoom.available_date}
                </div>
              ) : (
                <button onClick={openBooking} className="w-full px-4 py-4 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity">
                  Book Now
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </OldDashboardLayout>
    );
  }

  // ─── BOOKING FORM ───
  if (page === "booking" && selectedRoom) {
    const ic = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    const lbl = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
    const f = bookingForm;
    const set = (field: string, value: string) => setBookingForm({ ...f, [field]: value });

    return (
      <OldDashboardLayout>
        <div className="flex-1 p-6 overflow-auto text-foreground">
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
                    <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Couple</option><option>2 Pax</option>
                  </select>
                </div>
                <div className="space-y-1"><label className={lbl}>Nationality *</label><input className={ic} placeholder="Nationality" value={f.nationality} onChange={e => set("nationality", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Race *</label><input className={ic} placeholder="Race" value={f.race} onChange={e => set("race", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Move-in Date *</label><input className={ic} type="date" value={f.moveInDate} onChange={e => set("moveInDate", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Occupation *</label><input className={ic} placeholder="Occupation" value={f.occupation} onChange={e => set("occupation", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>Tenancy Duration (months) *</label>
                  <select className={ic} value={f.tenancyDuration} onChange={e => set("tenancyDuration", e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 6 ? " (half year)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1"><label className={lbl}>Monthly Rental (RM)</label><input className={ic} type="number" placeholder={String(selectedRoom.rent)} value={f.monthlyRental} onChange={e => { set("monthlyRental", e.target.value); set("advance", e.target.value); }} /></div>
                <div className="space-y-1"><label className={lbl}>How many pax staying *</label><input className={ic} type="number" placeholder="1" value={f.paxStaying} onChange={e => set("paxStaying", e.target.value)} /></div>
                <div className="space-y-1"><label className={lbl}>How many access card</label><input className={ic} type="number" placeholder="0" value={f.accessCardCount} onChange={e => set("accessCardCount", e.target.value)} /></div>
              </div>

              {/* Couple — Second Tenant Details */}
              {f.gender === "Couple" || f.gender === "2 Pax" && (
                <div className="mt-4 p-4 border border-dashed border-primary/30 rounded-lg space-y-4">
                  <div className="text-base font-bold flex items-center gap-2">👥 Second Tenant Details</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className={lbl}>Full Name *</label><input className={ic} placeholder="Full Name" value={f.tenant2Name} onChange={e => set("tenant2Name", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>NRIC/Passport No *</label><input className={ic} placeholder="NRIC/Passport No" value={f.tenant2IcPassport} onChange={e => set("tenant2IcPassport", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Email</label><input className={ic} type="email" placeholder="Email" value={f.tenant2Email} onChange={e => set("tenant2Email", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Contact No *</label><input className={ic} placeholder="Contact No" value={f.tenant2Phone} onChange={e => set("tenant2Phone", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Nationality</label><input className={ic} placeholder="Nationality" value={f.tenant2Nationality} onChange={e => set("tenant2Nationality", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Race</label><input className={ic} placeholder="Race" value={f.tenant2Race} onChange={e => set("tenant2Race", e.target.value)} /></div>
                    <div className="space-y-1"><label className={lbl}>Occupation</label><input className={ic} placeholder="Occupation" value={f.tenant2Occupation} onChange={e => set("tenant2Occupation", e.target.value)} /></div>
                  </div>
                </div>
              )}
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
                const unitCfg = unitsData.find(u => u.id === selectedRoom?.unit_id);
                const parkingType = (unitCfg as any)?.parking_type || "None";
                const availableCarParks = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available" && r.building === selectedRoom.building);
                return (
                  <>
                    {parkingType !== "None" && (
                      <div className="bg-accent/10 rounded-lg p-3">
                        <span className="text-sm font-medium">🅿️ Parking Registration: <strong>{parkingType}</strong></span>
                        {parkingType === "ANPR" && <span className="text-xs text-muted-foreground ml-2">(Car front & back photos required)</span>}
                      </div>
                    )}
                    {availableCarParks.length > 0 && (
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
                    )}
                  </>
                );
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
              {/* ANPR: car photos */}
              {(() => {
                const unitCfg = unitsData.find(u => u.id === selectedRoom?.unit_id);
                const parkingType = (unitCfg as any)?.parking_type || "None";
                if (parkingType !== "ANPR" || Number(f.parkingCount) === 0) return null;
                return (
                  <div className="space-y-3 bg-accent/10 rounded-lg p-4">
                    <div className="text-sm font-semibold">📸 ANPR — Upload car photos (front & back)</div>
                    {Array.from({ length: Number(f.parkingCount) }, (_, i) => (
                      <div key={i} className="space-y-2">
                        {Number(f.parkingCount) > 1 && <div className="text-sm font-medium">Car {i + 1}: {f.carPlates[i] || "—"}</div>}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className={lbl}>Front photo *</label>
                            <label className="block cursor-pointer border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground hover:bg-secondary/50 transition-colors">
                              {(uploadedFiles as any)[`carFront_${i}`] ? (uploadedFiles as any)[`carFront_${i}`].name : "Choose File"}
                              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setUploadedFiles(prev => ({ ...prev, [`carFront_${i}`]: e.target.files![0] })); }} />
                            </label>
                          </div>
                          <div className="space-y-1">
                            <label className={lbl}>Back photo *</label>
                            <label className="block cursor-pointer border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground hover:bg-secondary/50 transition-colors">
                              {(uploadedFiles as any)[`carBack_${i}`] ? (uploadedFiles as any)[`carBack_${i}`].name : "Choose File"}
                              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setUploadedFiles(prev => ({ ...prev, [`carBack_${i}`]: e.target.files![0] })); }} />
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
              {(() => {
                const unitCfg = unitsData.find(u => u.id === selectedRoom?.unit_id);
                const depMul = unitCfg?.deposit_multiplier ?? 1.5;
                const uAdminFee = unitCfg?.admin_fee ?? 330;
                const perCardCost = unitCfg?.access_card_deposit ?? 0;
                const cardSource = unitCfg?.access_card_source ?? "Provided by Us";
                const cardCount = Number(f.accessCardCount) || 0;
                const autoAccessCardDeposit = cardCount * perCardCost;
                const parkingType = (unitCfg as any)?.parking_type || "None";
                const parkingCardCost = (unitCfg as any)?.parking_card_deposit || 0;
                const parkingCount = Number(f.parkingCount) || 0;
                const parkingCardDeposit = parkingType === "Access Card" ? parkingCount * parkingCardCost : 0;
                const adv = Number(f.advance) || 0;
                const dep = Math.round(adv * depMul);
                const total = adv + dep + uAdminFee + (Number(f.electricityReload) || 0) + autoAccessCardDeposit + parkingCardDeposit;
                return (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1"><label className={lbl}>1 Month Advance Rental (RM)</label><input className={ic} type="number" placeholder="0" value={f.advance} onChange={e => set("advance", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Rental Deposit (RM) — ×{depMul}</label><input className={`${ic} bg-muted`} type="number" readOnly value={dep} /></div>
                      <div className="space-y-1"><label className={lbl}>Admin Fee (RM)</label><input className={`${ic} bg-muted`} type="number" readOnly value={uAdminFee} /></div>
                      <div className="space-y-1"><label className={lbl}>Electricity Reload (RM)</label><input className={ic} type="number" placeholder="0" value={f.electricityReload} onChange={e => set("electricityReload", e.target.value)} /></div>
                      <div className="space-y-1"><label className={lbl}>Access Card Deposit (RM) — {cardCount} card × RM{perCardCost} ({cardSource})</label><input className={`${ic} bg-muted`} type="number" readOnly value={autoAccessCardDeposit} /></div>
                      {parkingType === "Access Card" && parkingCount > 0 && (
                        <div className="space-y-1"><label className={lbl}>Parking Card Deposit (RM) — {parkingCount} × RM{parkingCardCost}</label><input className={`${ic} bg-muted`} type="number" readOnly value={parkingCardDeposit} /></div>
                      )}
                    </div>
                    <div className="bg-secondary rounded-lg p-4 text-right">
                      <span className="text-sm text-muted-foreground">Total: </span>
                      <span className="text-lg font-bold">RM{total}</span>
                    </div>
                  </>
                );
              })()}
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
      </OldDashboardLayout>
    );
  }

  // ─── BOOKING SUCCESS ───
  if (page === "booking-success" && bookingSubmitted) {
    return (
      <OldDashboardLayout>
        <div className="flex-1 p-6 overflow-auto text-foreground">
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
      </OldDashboardLayout>
    );
  }

  // ─── MY BOOKINGS PAGE ───
  if (page === "myBookings") {
    return (
      <OldDashboardLayout>
        <div className="flex-1 p-6 overflow-auto text-foreground">
          <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            <button onClick={() => setPage("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Dashboard</button>
            <AgentBookingsContent onEditBooking={(booking) => {
              // TODO: Pre-fill booking form and navigate to edit mode
              alert("Edit & Resubmit feature coming soon. Booking ID: " + booking.id.slice(0, 8));
            }} />
          </div>
        </div>
      </OldDashboardLayout>
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
      <OldDashboardLayout>
        <div className="flex-1 p-6 overflow-auto text-foreground">
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
      </OldDashboardLayout>
    );
  }

  // ─── DASHBOARD ───
  const availableCarParksCount = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available").length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyDeals = agentBookings.filter(b => b.submitted_by === user?.id && new Date(b.created_at) >= monthStart).length;


  // ─── BUILDING DETAIL PAGE ───
  if (page === "building" && selectedBuilding) {
    const buildingRooms = availableRooms.filter(r => r.building === selectedBuilding);
    const buildingCarParks = roomsData.filter(r => r.room_type === "Car Park" && r.status === "Available" && r.building === selectedBuilding).length;

    return (
      <OldDashboardLayout>
        <div className="flex-1 overflow-auto text-foreground">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
          <button onClick={() => setPage("dashboard")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{selectedBuilding}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{buildingRooms.length} available room{buildingRooms.length !== 1 ? "s" : ""}{buildingCarParks > 0 ? ` · 🅿️ ${buildingCarParks} car park${buildingCarParks > 1 ? "s" : ""}` : ""}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-xl border p-4">
            <div className="grid md:grid-cols-4 gap-3">
              <input className="px-3 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          {buildingRooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">No rooms match your filters</div>
          ) : (
            <div className="space-y-3">
              {buildingRooms.map((room) => (
                <div key={room.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition-all hover:border-primary/30 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{room.unit}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">{room.room} — <span className="font-bold text-primary text-lg">RM{room.rent}</span><span className="text-xs text-muted-foreground">/mo</span></div>
                      <div className="flex gap-1.5 flex-wrap mt-2.5">
                        <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium">{room.room_type}</span>
                        <span className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium">{room.unit_type}</span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${room.status === "Available Soon" ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent-foreground"}`}>{room.status === "Available Soon" ? `🕐 Available ${room.available_date}` : room.available_date}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                        <span>Max: {room.unit_max_pax}</span>
                        <span>Occupied: {room.unit_occupied_pax}</span>
                        <span className="font-semibold text-foreground">Balance: {room.unit_max_pax - room.unit_occupied_pax}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => openRoom(room)} className="px-4 py-2 rounded-lg border text-foreground hover:bg-secondary transition-colors text-sm font-medium">Details</button>
                      {room.status === "Available Soon" ? (
                        <div className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium text-center">🕐 Coming Soon</div>
                      ) : (
                        <button onClick={() => { setSelectedRoom(room); openBooking(); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">Book</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </OldDashboardLayout>
    );
  }

  return (
    <OldDashboardLayout activeTab={adminTab} onTabChange={(t) => { setAdminTab(t); setPage("dashboard"); setBuildingFormOpen(false); setBuildingFormData(undefined); }}>
      <div className="flex-1 overflow-auto text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
        {/* Admin Content for non-dashboard tabs */}
        {isAdmin && adminTab !== "dashboard" && (
          <div className="max-w-5xl mx-auto">
            {adminTab === "locations" ? <LocationsContent /> :
             adminTab === "condos" ? (
               <>
                 <CondosContent onOpenForm={(building?: Condo) => { setBuildingFormData(building); setBuildingFormOpen(true); }} />
                 <Dialog open={buildingFormOpen} onOpenChange={() => {}}>
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                     <div className="flex-1 overflow-y-auto p-6">
                       <BuildingForm building={buildingFormData} onClose={() => { setBuildingFormOpen(false); setBuildingFormData(undefined); }} />
                     </div>
                   </DialogContent>
                 </Dialog>
               </>
             ) :
             adminTab === "rooms" ? <RoomsContent /> :
             adminTab === "tenants" ? <TenantsContent /> :
             adminTab === "movein" ? <MoveInContent /> :
             adminTab === "bookings" ? <BookingsContent /> :
             <AdminContent tab={adminTab as any} />}
          </div>
        )}

        {/* Show dashboard content only when on dashboard tab */}
        {isAdmin && adminTab === "dashboard" && (
          <AdminDashboardContent onTabChange={(t) => { setAdminTab(t); setPage("dashboard"); }} />
        )}
        </div>
      </div>
    </OldDashboardLayout>
  );
}

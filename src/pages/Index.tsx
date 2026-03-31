import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { useRooms, Room } from "@/hooks/useRooms";
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
  advance: "", deposit: "", adminFee: "", electricityReload: "",
};

const rankMedals = ["🥇", "🥈", "🥉"];

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: roomsData = [], isLoading: roomsLoading } = useRooms();
  const [page, setPage] = useState("dashboard");
  const [agentType, setAgentType] = useState("External");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [bookingSubmitted, setBookingSubmitted] = useState<{ room: Room; announcement: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ location: "All", price: "All", unitType: "All", roomType: "All" });
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ passport: File[]; offerLetter: File[]; transferSlip: File[] }>({ passport: [], offerLetter: [], transferSlip: [] });

  const uniqueLocations = useMemo(() => {
    const locs = new Set(roomsData.map((r) => r.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [roomsData]);

  const availableRooms = useMemo(() => {
    return roomsData.filter((room) => {
      if (room.status !== "Available") return false;
      const keyword = search.trim().toLowerCase();
      const matchesSearch = keyword === "" || room.building.toLowerCase().includes(keyword) || room.unit.toLowerCase().includes(keyword) || room.room.toLowerCase().includes(keyword) || room.location.toLowerCase().includes(keyword);
      const matchesLocation = filters.location === "All" || room.location === filters.location;
      const matchesUnitType = filters.unitType === "All" || room.unit_type === filters.unitType;
      const matchesPrice = filters.price === "All" || (filters.price === "Below RM700" && room.rent < 700) || (filters.price === "RM700 - RM900" && room.rent >= 700 && room.rent <= 900) || (filters.price === "Above RM900" && room.rent > 900);
      return matchesSearch && matchesLocation && matchesUnitType && matchesPrice;
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
  const openBooking = () => { setBookingForm(initialBookingForm); setUploadedFiles({ passport: [], offerLetter: [], transferSlip: [] }); setPage("booking"); };

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

  const submitBooking = async () => {
    const error = validateBooking();
    if (error) { alert(error); return; }
    if (!selectedRoom || !user) return;
    setSubmitting(true);
    try {
      // Upload files
      const passportPaths = await Promise.all(uploadedFiles.passport.map(f => uploadFile(f, "passport")));
      const offerPaths = await Promise.all(uploadedFiles.offerLetter.map(f => uploadFile(f, "offer-letter")));
      const slipPaths = await Promise.all(uploadedFiles.transferSlip.map(f => uploadFile(f, "transfer-slip")));

      const advance = Number(bookingForm.advance) || 0;
      const deposit = Number(bookingForm.deposit) || 0;
      const adminFee = Number(bookingForm.adminFee) || 0;
      const electricityReload = Number(bookingForm.electricityReload) || 0;
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
        move_in_cost: { advance, deposit, adminFee, electricityReload, total: advance + deposit + adminFee + electricityReload },
        doc_passport: passportPaths,
        doc_offer_letter: offerPaths,
        doc_transfer_slip: slipPaths,
      });
      if (dbErr) throw dbErr;
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
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {selectedRoom.photos.map((label) => (
                  <div key={label} className="h-48 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground font-medium">{label}</div>
                ))}
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
                    {selectedRoom.housemates.map((item) => <div key={item}>{item}</div>)}
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
              <button onClick={openBooking} className="w-full px-4 py-4 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity">
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

            {/* Parking */}
            <div className="space-y-4">
              <div className="text-lg font-bold flex items-center gap-2">🅿️ Parking</div>
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
              </div>
              <div className="bg-secondary rounded-lg p-4 text-right">
                <span className="text-sm text-muted-foreground">Total: </span>
                <span className="text-lg font-bold">RM{(Number(f.advance) || 0) + (Number(f.deposit) || 0) + (Number(f.adminFee) || 0) + (Number(f.electricityReload) || 0)}</span>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setPage("detail")} className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={submitBooking} disabled={submitting} className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Booking"}
              </button>
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

  // ─── DASHBOARD ───
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1">Agent Dashboard</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold uppercase">{role ?? "agent"}</span>
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            {[
              { label: "Closed This Month", value: "6 deals" },
              { label: "Pending Claims", value: "3" },
              { label: "Next Payout", value: "15th" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-lg shadow-sm px-4 py-3 text-sm">
                <span className="text-muted-foreground">{stat.label}: </span>
                <span className="font-semibold text-foreground">{stat.value}</span>
              </div>
            ))}
            {role === "admin" && (
              <button onClick={() => navigate("/admin")} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-80 transition-opacity">
                Admin Panel
              </button>
            )}
            <button onClick={signOut} className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-6">
          <div className="space-y-6">
            <div className="bg-card rounded-lg shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold">Available Units</div>
                <span className="text-sm text-muted-foreground">{availableRooms.length} rooms</span>
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <input className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">Area</label>
                  <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
                    <option>All</option>{uniqueLocations.map((loc) => <option key={loc}>{loc}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">Price</label>
                  <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.price} onChange={(e) => setFilters({ ...filters, price: e.target.value })}>
                    <option>All</option><option>Below RM700</option><option>RM700 - RM900</option><option>Above RM900</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground pl-1">Gender</label>
                  <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.unitType} onChange={(e) => setFilters({ ...filters, unitType: e.target.value })}>
                    <option>All</option><option>Female Unit</option><option>Mix Unit</option>
                  </select>
                </div>
              </div>
              {roomsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading rooms...</div>
              ) : (
                <div className="space-y-3">
                  {availableRooms.map((room) => (
                    <div key={room.id} className="rounded-lg border p-5 grid md:grid-cols-[1fr_auto] gap-4 items-center hover:shadow-md transition-shadow">
                      <div>
                        <div className="text-lg font-semibold">{room.building} {room.unit}</div>
                        <div className="text-muted-foreground mt-1">{room.room} — <span className="font-semibold text-foreground">RM{room.rent}</span>/mo</div>
                        <div className="flex gap-2 flex-wrap mt-2">
                          <span className="px-3 py-1 rounded-md bg-secondary text-sm font-medium">{room.room_type}</span>
                          <span className="px-3 py-1 rounded-md bg-secondary text-sm font-medium">{room.unit_type}</span>
                          <span className="px-3 py-1 rounded-md bg-accent text-accent-foreground text-sm font-medium">{room.available_date}</span>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground flex gap-4">
                          <span>Max: {room.unit_max_pax}</span>
                          <span>Occupied: {room.unit_occupied_pax}</span>
                          <span>Balance: {room.unit_max_pax - room.unit_occupied_pax}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <button onClick={() => openRoom(room)} className="px-4 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors text-sm font-medium">View Details</button>
                        <button onClick={() => { setSelectedRoom(room); openBooking(); }} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">Book Now</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-lg shadow-sm p-5">
              <div className="text-xl font-semibold">Top Agent Ranking</div>
              <div className="text-sm text-muted-foreground mt-1">Showing {agentType.toLowerCase()} agents</div>
              <div className="mt-4 space-y-3">
                {ranking.map((item, i) => (
                  <div key={item.rank} className="rounded-lg bg-secondary p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{rankMedals[i]}</span>
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.deals} deals</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg shadow-sm p-5">
              <div className="text-xl font-semibold">Claim Summary</div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  { label: "Pending Claim", value: "RM1,200" },
                  { label: "Approved Claim", value: "RM3,000" },
                  { label: "Next Payout", value: "15th" },
                  { label: "CP58", value: "Available after year end" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-secondary p-4 flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
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

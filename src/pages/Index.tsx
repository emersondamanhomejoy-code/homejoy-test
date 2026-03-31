import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";

interface Room {
  id: number;
  building: string;
  unit: string;
  room: string;
  location: string;
  rent: number;
  roomType: string;
  unitType: string;
  status: string;
  availableDate: string;
  maxPax: number;
  occupiedPax: number;
  unitMaxPax: number;
  unitOccupiedPax: number;
  housemates: string[];
  photos: string[];
  access: {
    condoEntry: string;
    unitAccess: string;
    visitorParking: string;
    viewing: string;
  };
  moveInCost: {
    advance: number;
    deposit: number;
    accessCard: number;
    moveInFee: number;
    total: number;
  };
}

const roomsData: Room[] = [
  {
    id: 1, building: "D'Aman Crimson", unit: "A-17-8", room: "Room B",
    location: "Ara Damansara", rent: 850, roomType: "Medium Room", unitType: "Mix Unit",
    status: "Available", availableDate: "Available Now", maxPax: 1, occupiedPax: 0,
    unitMaxPax: 6, unitOccupiedPax: 4,
    housemates: ["Room A: 1 Female", "Room C: 2 Male", "Room D: Vacant", "Room E: 1 Female"],
    photos: ["Room Photo", "Unit Photo"],
    access: { condoEntry: "Register at guardhouse", unitAccess: "Smart lock passcode from admin", visitorParking: "Visitor parking available", viewing: "Self check-in allowed" },
    moveInCost: { advance: 850, deposit: 1275, accessCard: 100, moveInFee: 330, total: 2555 },
  },
  {
    id: 2, building: "Casa Subang", unit: "B-18-3", room: "Room C",
    location: "Subang", rent: 650, roomType: "Single Room", unitType: "Female Unit",
    status: "Available", availableDate: "Available Now", maxPax: 2, occupiedPax: 0,
    unitMaxPax: 6, unitOccupiedPax: 3,
    housemates: ["Room A: 1 Female", "Room B: 1 Female", "Room D: 1 Female", "Room E: Vacant"],
    photos: ["Room Photo", "Unit Photo"],
    access: { condoEntry: "Register with guard", unitAccess: "Collect key from lock box", visitorParking: "Street parking nearby", viewing: "Contact admin before viewing" },
    moveInCost: { advance: 650, deposit: 975, accessCard: 0, moveInFee: 330, total: 1955 },
  },
  {
    id: 3, building: "Kelana Puteri", unit: "B-5-11", room: "Room D",
    location: "PJ", rent: 750, roomType: "Medium Room", unitType: "Mix Unit",
    status: "Available", availableDate: "1 Apr 2026", maxPax: 1, occupiedPax: 0,
    unitMaxPax: 5, unitOccupiedPax: 3,
    housemates: ["Room A: 1 Male", "Room B: 1 Female", "Room C: 1 Male", "Room E: Vacant"],
    photos: ["Room Photo", "Unit Photo"],
    access: { condoEntry: "Register IC at guardhouse", unitAccess: "Passcode provided after viewing confirmation", visitorParking: "Visitor parking RM2", viewing: "Meet admin at lobby" },
    moveInCost: { advance: 750, deposit: 1125, accessCard: 100, moveInFee: 330, total: 2305 },
  },
];

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
  tenantName: "", phone: "", tenantCategory: "Working Adult", pax: "1",
  gender: "", race: "", moveInDate: "",
  passportIcUploaded: false, bankSlipUploaded: false,
  studentIdUploaded: false, offerLetterUploaded: false,
};

const rankMedals = ["🥇", "🥈", "🥉"];

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState("dashboard");
  const [agentType, setAgentType] = useState("External");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [bookingSubmitted, setBookingSubmitted] = useState<{ room: Room; announcement: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ location: "All", price: "All", unitType: "All", roomType: "All" });
  const [signingIn, setSigningIn] = useState(false);

  const availableRooms = useMemo(() => {
    return roomsData.filter((room) => {
      if (room.status !== "Available") return false;
      const keyword = search.trim().toLowerCase();
      const matchesSearch = keyword === "" || room.building.toLowerCase().includes(keyword) || room.unit.toLowerCase().includes(keyword) || room.room.toLowerCase().includes(keyword) || room.location.toLowerCase().includes(keyword);
      const matchesLocation = filters.location === "All" || room.location === filters.location;
      const matchesUnitType = filters.unitType === "All" || room.unitType === filters.unitType;
      const matchesPrice = filters.price === "All" || (filters.price === "Below RM700" && room.rent < 700) || (filters.price === "RM700 - RM900" && room.rent >= 700 && room.rent <= 900) || (filters.price === "Above RM900" && room.rent > 900);
      return matchesSearch && matchesLocation && matchesUnitType && matchesPrice;
    });
  }, [search, filters]);

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
    `Hi, here is the move-in cost breakdown:\n\n${room.building} ${room.unit} ${room.room}\nMonthly Rent: RM${room.rent}\n• 1 Month Advance: RM${room.moveInCost.advance}\n• Deposit: RM${room.moveInCost.deposit}\n• Access Card: RM${room.moveInCost.accessCard}\n• Move-in Fee: RM${room.moveInCost.moveInFee}\n\nTotal: RM${room.moveInCost.total}`;

  const bookingAnnouncement = (room: Room) =>
    `${room.building} ${room.unit} ${room.room} booking received\n${bookingForm.pax} pax ${bookingForm.race} ${bookingForm.gender}`;

  const openRoom = (room: Room) => { setSelectedRoom(room); setPage("detail"); };
  const openBooking = () => { setBookingForm(initialBookingForm); setPage("booking"); };

  const validateBooking = () => {
    if (!selectedRoom) return "No room selected.";
    if (selectedRoom.status !== "Available") return "This room is no longer available.";
    if (!bookingForm.tenantName || !bookingForm.phone || !bookingForm.gender || !bookingForm.race || !bookingForm.moveInDate) return "Please complete all required fields.";
    if (Number(bookingForm.pax) > selectedRoom.maxPax - selectedRoom.occupiedPax) return `Only ${selectedRoom.maxPax - selectedRoom.occupiedPax} pax slot left.`;
    if (!bookingForm.passportIcUploaded) return "Please upload Passport / IC soft copy.";
    if (!bookingForm.bankSlipUploaded) return "Please upload bank slip.";
    if (bookingForm.tenantCategory === "Student") {
      if (!bookingForm.studentIdUploaded) return "Please upload student ID.";
      if (!bookingForm.offerLetterUploaded) return "Please upload offer letter.";
    }
    return "";
  };

  const submitBooking = () => {
    const error = validateBooking();
    if (error) { alert(error); return; }
    setBookingSubmitted({ room: selectedRoom!, announcement: bookingAnnouncement(selectedRoom!) });
    setPage("booking-success");
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
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.roomType}</span>
                  <span className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">{selectedRoom.unitType}</span>
                  <span className="px-3 py-1 rounded-md bg-accent text-accent-foreground text-sm font-medium">{selectedRoom.availableDate}</span>
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
                  <div>Room Max Pax: {selectedRoom.maxPax}</div>
                  <div>Available Pax Left: {selectedRoom.maxPax - selectedRoom.occupiedPax}</div>
                  <div>Unit Max Pax: {selectedRoom.unitMaxPax}</div>
                  <div>Unit Occupied Pax: {selectedRoom.unitOccupiedPax}</div>
                  <div>Unit Balance Pax: {selectedRoom.unitMaxPax - selectedRoom.unitOccupiedPax}</div>
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
                <div className="mt-3 text-sm space-y-2 text-muted-foreground">
                  <div>Condo Entry: {selectedRoom.access.condoEntry}</div>
                  <div>Unit Access: {selectedRoom.access.unitAccess}</div>
                  <div>Visitor Parking: {selectedRoom.access.visitorParking}</div>
                  <div>Viewing: {selectedRoom.access.viewing}</div>
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-5">
                <div className="text-lg font-semibold">Move-in Cost</div>
                <div className="mt-3 text-sm space-y-2 text-muted-foreground">
                  <div className="flex justify-between"><span>1 Month Advance</span><span>RM{selectedRoom.moveInCost.advance}</span></div>
                  <div className="flex justify-between"><span>Deposit</span><span>RM{selectedRoom.moveInCost.deposit}</span></div>
                  <div className="flex justify-between"><span>Access Card</span><span>RM{selectedRoom.moveInCost.accessCard}</span></div>
                  <div className="flex justify-between"><span>Move-in Fee</span><span>RM{selectedRoom.moveInCost.moveInFee}</span></div>
                  <div className="pt-2 border-t flex justify-between font-semibold text-foreground"><span>Total</span><span>RM{selectedRoom.moveInCost.total}</span></div>
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
    const availablePax = selectedRoom.maxPax - selectedRoom.occupiedPax;
    const inputClass = "px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    const checkboxLabel = "rounded-lg border p-4 flex items-center gap-3 bg-card text-foreground cursor-pointer hover:bg-secondary transition-colors";

    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <button onClick={() => setPage("detail")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Room Detail
          </button>
          <div className="bg-card rounded-lg shadow-lg p-6 space-y-6">
            <div>
              <div className="text-2xl font-bold">Booking Form</div>
              <div className="text-muted-foreground mt-1">{selectedRoom.building} {selectedRoom.unit} {selectedRoom.room}</div>
            </div>
            <div className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground space-y-1">
              <div>Room Max Pax: {selectedRoom.maxPax}</div>
              <div>Available Pax Left: {availablePax}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <input className={inputClass} placeholder="Tenant name" value={bookingForm.tenantName} onChange={(e) => setBookingForm({ ...bookingForm, tenantName: e.target.value })} />
              <input className={inputClass} placeholder="Phone number" value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} />
              <select className={inputClass} value={bookingForm.tenantCategory} onChange={(e) => setBookingForm({ ...bookingForm, tenantCategory: e.target.value })}>
                <option>Working Adult</option>
                <option>Student</option>
              </select>
              <select className={inputClass} value={bookingForm.pax} onChange={(e) => setBookingForm({ ...bookingForm, pax: e.target.value })}>
                {Array.from({ length: availablePax }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
              </select>
              <select className={inputClass} value={bookingForm.gender} onChange={(e) => setBookingForm({ ...bookingForm, gender: e.target.value })}>
                <option value="">Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
              <input className={inputClass} placeholder="Race" value={bookingForm.race} onChange={(e) => setBookingForm({ ...bookingForm, race: e.target.value })} />
              <input className={`${inputClass} md:col-span-2`} type="date" value={bookingForm.moveInDate} onChange={(e) => setBookingForm({ ...bookingForm, moveInDate: e.target.value })} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label className={checkboxLabel}>
                <input type="checkbox" checked={bookingForm.passportIcUploaded} onChange={(e) => setBookingForm({ ...bookingForm, passportIcUploaded: e.target.checked })} className="accent-primary w-4 h-4" />
                <span>Passport / IC soft copy uploaded</span>
              </label>
              <label className={checkboxLabel}>
                <input type="checkbox" checked={bookingForm.bankSlipUploaded} onChange={(e) => setBookingForm({ ...bookingForm, bankSlipUploaded: e.target.checked })} className="accent-primary w-4 h-4" />
                <span>Bank slip uploaded</span>
              </label>
              {bookingForm.tenantCategory === "Student" && (
                <>
                  <label className={checkboxLabel}>
                    <input type="checkbox" checked={bookingForm.studentIdUploaded} onChange={(e) => setBookingForm({ ...bookingForm, studentIdUploaded: e.target.checked })} className="accent-primary w-4 h-4" />
                    <span>Student ID uploaded</span>
                  </label>
                  <label className={checkboxLabel}>
                    <input type="checkbox" checked={bookingForm.offerLetterUploaded} onChange={(e) => setBookingForm({ ...bookingForm, offerLetterUploaded: e.target.checked })} className="accent-primary w-4 h-4" />
                    <span>Offer letter uploaded</span>
                  </label>
                </>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPage("detail")} className="px-5 py-3 rounded-lg border text-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={submitBooking} className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Submit Booking</button>
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
                Manage Users
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
                <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
                  <option>All</option><option>Ara Damansara</option><option>Subang</option><option>PJ</option>
                </select>
                <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.price} onChange={(e) => setFilters({ ...filters, price: e.target.value })}>
                  <option>All</option><option>Below RM700</option><option>RM700 - RM900</option><option>Above RM900</option>
                </select>
                <select className="px-4 py-3 rounded-lg border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={filters.unitType} onChange={(e) => setFilters({ ...filters, unitType: e.target.value })}>
                  <option>All</option><option>Female Unit</option><option>Mix Unit</option>
                </select>
              </div>
              <div className="space-y-3">
                {availableRooms.map((room) => (
                  <div key={room.id} className="rounded-lg border p-5 grid md:grid-cols-[1fr_auto] gap-4 items-center hover:shadow-md transition-shadow">
                    <div>
                      <div className="text-lg font-semibold">{room.building} {room.unit}</div>
                      <div className="text-muted-foreground mt-1">{room.room} — <span className="font-semibold text-foreground">RM{room.rent}</span>/mo</div>
                      <div className="flex gap-2 flex-wrap mt-2">
                        <span className="px-3 py-1 rounded-md bg-secondary text-sm font-medium">{room.roomType}</span>
                        <span className="px-3 py-1 rounded-md bg-secondary text-sm font-medium">{room.unitType}</span>
                        <span className="px-3 py-1 rounded-md bg-accent text-accent-foreground text-sm font-medium">{room.availableDate}</span>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground flex gap-4">
                        <span>Max: {room.unitMaxPax}</span>
                        <span>Occupied: {room.unitOccupiedPax}</span>
                        <span>Balance: {room.unitMaxPax - room.unitOccupiedPax}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <button onClick={() => openRoom(room)} className="px-4 py-2.5 rounded-lg border text-foreground hover:bg-secondary transition-colors text-sm font-medium">View Details</button>
                      <button onClick={() => { setSelectedRoom(room); openBooking(); }} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">Book Now</button>
                    </div>
                  </div>
                ))}
              </div>
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

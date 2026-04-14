import { useMemo } from "react";
import { useBookings } from "@/hooks/useBookings";
import { useMoveIns } from "@/hooks/useMoveIns";
import { useUnits } from "@/hooks/useRooms";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, LogIn, BedDouble, Clock, AlertCircle,
  DollarSign, Car, Plus, UserPlus, Eye, CreditCard,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

interface AdminDashboardContentProps {
  onTabChange: (tab: string) => void;
}

export function AdminDashboardContent({ onTabChange }: AdminDashboardContentProps) {
  const { data: allBookings = [] } = useBookings();
  const { data: allMoveIns = [] } = useMoveIns();
  const { data: units = [] } = useUnits();

  const allRooms = useMemo(() => units.flatMap(u => u.rooms || []), [units]);

  const submittedBookings = useMemo(() => allBookings.filter(b => b.status === "submitted"), [allBookings]);
  const submittedMoveIns = useMemo(() => allMoveIns.filter(m => m.status === "submitted"), [allMoveIns]);

  const today = new Date().toISOString().slice(0, 10);
  const roomsAvailableSoonReady = useMemo(
    () => allRooms.filter(r => r.room_type !== "Car Park" && r.status === "Available Soon" && r.available_date && r.available_date <= today),
    [allRooms, today]
  );
  const carparksAvailableSoonReady = useMemo(
    () => allRooms.filter(r => r.room_type === "Car Park" && r.status === "Available Soon" && r.available_date && r.available_date <= today),
    [allRooms, today]
  );

  // Placeholder payout count — will be real once payouts module is built
  const pendingPayouts = 0;

  const summaryCards = [
    { label: "Submitted Bookings", subtitle: "Waiting for review", value: submittedBookings.length, icon: ClipboardList, color: "text-amber-500", bg: "bg-amber-500/10", tab: "bookings" },
    { label: "Submitted Move-ins", subtitle: "Waiting for review", value: submittedMoveIns.length, icon: LogIn, color: "text-blue-500", bg: "bg-blue-500/10", tab: "movein" },
    { label: "Rooms Ready", subtitle: "Available Soon date reached", value: roomsAvailableSoonReady.length, icon: BedDouble, color: "text-emerald-500", bg: "bg-emerald-500/10", tab: "rooms" },
    { label: "Carparks Ready", subtitle: "Available Soon date reached", value: carparksAvailableSoonReady.length, icon: Car, color: "text-sky-500", bg: "bg-sky-500/10", tab: "rooms" },
    { label: "Pending Payouts", subtitle: "Awaiting processing", value: pendingPayouts, icon: DollarSign, color: "text-orange-500", bg: "bg-orange-500/10", tab: "payouts" },
  ];

  const quickActions = [
    { label: "Add Booking", icon: Plus, tab: "bookings" },
    { label: "Add Tenant", icon: UserPlus, tab: "tenants" },
    { label: "Add Unit", icon: Plus, tab: "units" },
    { label: "Review Bookings", icon: Eye, tab: "bookings" },
    { label: "Review Move-ins", icon: Eye, tab: "movein" },
    { label: "Generate Payout", icon: CreditCard, tab: "payouts" },
  ];

  const formatTime = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd MMM yyyy, HH:mm"); } catch { return dateStr; }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <StatCard
            key={card.label}
            label={card.label}
            subtitle={card.subtitle}
            value={card.value}
            icon={card.icon}
            iconColor={card.color}
            iconBg={card.bg}
            onClick={() => onTabChange(card.tab)}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(action => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => onTabChange(action.tab)}
            >
              <action.icon className="h-5 w-5 text-primary" />
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Submitted Bookings */}
      <div className="bg-card rounded-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Submitted Bookings</h2>
          {submittedBookings.length > 5 && (
            <Button variant="link" size="sm" onClick={() => onTabChange("bookings")}>
              View All ({submittedBookings.length})
            </Button>
          )}
        </div>
        {submittedBookings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No bookings waiting for review</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Move-in Date</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submittedBookings.slice(0, 5).map(b => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-medium">{b.tenant_name}</TableCell>
                  <TableCell className="text-sm">
                    {b.room ? `${b.room.building} · ${b.room.unit} · ${b.room.room}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{b.move_in_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatTime(b.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onTabChange("bookings")}>Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Submitted Move-ins */}
      <div className="bg-card rounded-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Submitted Move-ins</h2>
          {submittedMoveIns.length > 5 && (
            <Button variant="link" size="sm" onClick={() => onTabChange("movein")}>
              View All ({submittedMoveIns.length})
            </Button>
          )}
        </div>
        {submittedMoveIns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No move-ins waiting for review</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submittedMoveIns.slice(0, 5).map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-medium">{m.tenant_name}</TableCell>
                  <TableCell className="text-sm">
                    {m.room ? `${m.room.building} · ${m.room.unit} · ${m.room.room}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatTime(m.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onTabChange("movein")}>Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Rooms & Carparks needing confirmation */}
      {(roomsAvailableSoonReady.length > 0 || carparksAvailableSoonReady.length > 0) && (
        <div className="bg-card rounded-lg border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Available Soon — Date Reached
            </h2>
            <Button variant="link" size="sm" onClick={() => onTabChange("rooms")}>Go to Rooms</Button>
          </div>
          <div className="p-5 space-y-3">
            {roomsAvailableSoonReady.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Rooms ({roomsAvailableSoonReady.length})</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {roomsAvailableSoonReady.slice(0, 6).map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{r.building} · {r.unit} · {r.room}</span>
                      <span className="text-xs text-muted-foreground">{r.available_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {carparksAvailableSoonReady.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Carparks ({carparksAvailableSoonReady.length})</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {carparksAvailableSoonReady.slice(0, 6).map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{r.building} · {r.unit} · {r.room}</span>
                      <span className="text-xs text-muted-foreground">{r.available_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

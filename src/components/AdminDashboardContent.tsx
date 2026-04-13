import { useMemo } from "react";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useMoveIns } from "@/hooks/useMoveIns";
import { useUnits } from "@/hooks/useRooms";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, LogIn, BedDouble, Clock, AlertCircle, CheckCircle,
  MapPin, Building, Building2, Users, Bell, User,
} from "lucide-react";

interface AdminDashboardContentProps {
  onTabChange: (tab: string) => void;
}

export function AdminDashboardContent({ onTabChange }: AdminDashboardContentProps) {
  const { user } = useAuth();
  const { data: allBookings = [] } = useBookings();
  const { data: allMoveIns = [] } = useMoveIns();
  const { data: units = [] } = useUnits();

  // Room stats
  const roomStats = useMemo(() => {
    const allRooms = units.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park"));
    return {
      available: allRooms.filter(r => r.status === "Available").length,
      availableSoon: allRooms.filter(r => r.status === "Available Soon").length,
      pending: allRooms.filter(r => r.status === "Pending").length,
      occupied: allRooms.filter(r => r.status === "Tenanted" || r.status === "Occupied").length,
      archived: allRooms.filter(r => r.status === "Archived").length,
      total: allRooms.length,
    };
  }, [units]);

  const pendingBookings = useMemo(() => allBookings.filter(b => b.status === "submitted"), [allBookings]);
  const pendingMoveIns = useMemo(() => allMoveIns.filter(m => m.status === "submitted"), [allMoveIns]);

  const summaryCards = [
    { label: "Pending Bookings", value: pendingBookings.length, icon: ClipboardList, color: "text-amber-500", bg: "bg-amber-500/10", tab: "bookings" },
    { label: "Pending Move In", value: pendingMoveIns.length, icon: LogIn, color: "text-blue-500", bg: "bg-blue-500/10", tab: "movein" },
    { label: "Rooms Available", value: roomStats.available, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", tab: "rooms" },
    { label: "Available Soon", value: roomStats.availableSoon, icon: Clock, color: "text-sky-500", bg: "bg-sky-500/10", tab: "rooms" },
    { label: "Rooms Pending", value: roomStats.pending, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10", tab: "rooms" },
    { label: "Rooms Occupied", value: roomStats.occupied, icon: BedDouble, color: "text-rose-500", bg: "bg-rose-500/10", tab: "rooms" },
  ];

  const statusBreakdown = [
    { label: "Available", count: roomStats.available, color: "bg-emerald-500" },
    { label: "Available Soon", count: roomStats.availableSoon, color: "bg-sky-500" },
    { label: "Pending", count: roomStats.pending, color: "bg-orange-500" },
    { label: "Occupied", count: roomStats.occupied, color: "bg-rose-500" },
    { label: "Archived", count: roomStats.archived, color: "bg-muted-foreground" },
  ];

  const quickActions = [
    { label: "Add Location", icon: MapPin, tab: "locations" },
    { label: "Add Building", icon: Building, tab: "condos" },
    { label: "Add Unit & Room", icon: Building2, tab: "units" },
    { label: "Add User", icon: Users, tab: "users" },
  ];

  const formatTime = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd MMM yyyy, HH:mm"); } catch { return dateStr; }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {pendingBookings.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {pendingBookings.length}
              </span>
            )}
          </Button>
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(card => (
          <button
            key={card.label}
            onClick={() => onTabChange(card.tab)}
            className="bg-card rounded-lg border p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{card.label}</div>
          </button>
        ))}
      </div>

      {/* 3. Pending Bookings Preview */}
      <div className="bg-card rounded-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Pending Bookings</h2>
          {pendingBookings.length > 5 && (
            <Button variant="link" size="sm" onClick={() => onTabChange("bookings")}>
              View All ({pendingBookings.length})
            </Button>
          )}
        </div>
        {pendingBookings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending bookings</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingBookings.slice(0, 5).map(b => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-mono text-muted-foreground">{b.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm font-medium">{b.tenant_name}</TableCell>
                  <TableCell className="text-sm">
                    {b.room ? `${b.room.building} · ${b.room.unit} · ${b.room.room}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatTime(b.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onTabChange("bookings")}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 4. Pending Move In Preview */}
      <div className="bg-card rounded-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Pending Move In</h2>
          {pendingMoveIns.length > 5 && (
            <Button variant="link" size="sm" onClick={() => onTabChange("movein")}>
              View All ({pendingMoveIns.length})
            </Button>
          )}
        </div>
        {pendingMoveIns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending move-ins</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingMoveIns.slice(0, 5).map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-mono text-muted-foreground">{m.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm font-medium">{m.tenant_name}</TableCell>
                  <TableCell className="text-sm">
                    {m.room ? `${m.room.building} · ${m.room.unit} · ${m.room.room}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatTime(m.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => onTabChange("movein")}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 5. Room Status Overview */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Room Status Overview</h2>
        <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden mb-4">
          {statusBreakdown.filter(s => s.count > 0).map(s => (
            <div
              key={s.label}
              className={`${s.color} h-full transition-all`}
              style={{ width: `${(s.count / Math.max(roomStats.total, 1)) * 100}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statusBreakdown.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${s.color}`} />
              <div>
                <span className="text-sm font-medium">{s.count}</span>
                <span className="text-xs text-muted-foreground ml-1">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Quick Actions */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
    </div>
  );
}

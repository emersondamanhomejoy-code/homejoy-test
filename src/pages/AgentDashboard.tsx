import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useRooms";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  BedDouble, ClipboardList, LogIn, CheckCircle, DollarSign,
  Search, Plus, Upload,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

interface CommissionConfig {
  percentage?: number;
  tiers?: { min: number; max: number | null; amount?: number; percentage?: number }[];
}

export default function AgentDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { data: allBookings = [] } = useBookings();
  const { data: units = [] } = useUnits();

  const [commissionType, setCommissionType] = useState("internal_basic");
  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    else if (!loading && user && role && role !== "agent") navigate("/admin", { replace: true });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("commission_type, commission_config").eq("user_id", user.id).eq("role", "agent").single()
      .then(({ data }) => {
        if (data?.commission_type) setCommissionType(data.commission_type);
        if (data?.commission_config) setCommissionConfig(data.commission_config as CommissionConfig);
      });
  }, [user]);

  // Available rooms
  const availableRooms = useMemo(() => {
    return units.flatMap(u => (u.rooms || []).filter(r => r.room_type !== "Car Park" && r.status === "Available"));
  }, [units]);

  // My bookings
  const myBookings = useMemo(() => allBookings.filter(b => b.submitted_by === user?.id), [allBookings, user?.id]);

  const submittedBookings = useMemo(() => myBookings.filter(b => b.order_status === "booking_submitted"), [myBookings]);
  const readyForMoveIn = useMemo(() => myBookings.filter(b => b.order_status === "booking_approved"), [myBookings]);
  const submittedMoveIns = useMemo(() => myBookings.filter(b => b.order_status === "move_in_submitted"), [myBookings]);
  const completedDeals = useMemo(() => myBookings.filter(b => b.order_status === "move_in_approved"), [myBookings]);

  const calculateCommission = (booking: Booking): number => {
    const rent = booking.monthly_salary || 0;
    const duration = booking.contract_months || 12;
    const durationMultiplier = duration / 12;
    const config = commissionConfig;
    let base = 0;
    if (commissionType === "external") {
      base = Math.round(rent * (config?.percentage ?? 100) / 100);
    } else if (commissionType === "internal_full") {
      const tiers = config?.tiers || [{ min: 1, max: 300, percentage: 70 }, { min: 301, max: null, percentage: 75 }];
      const tier = tiers.find(t => completedDeals.length >= t.min && (t.max === null || completedDeals.length <= t.max));
      base = Math.round(rent * (tier?.percentage ?? 70) / 100);
    } else {
      const tiers = config?.tiers || [{ min: 1, max: 5, amount: 200 }, { min: 6, max: 10, amount: 300 }, { min: 11, max: null, amount: 400 }];
      const tier = tiers.find(t => completedDeals.length >= t.min && (t.max === null || completedDeals.length <= t.max));
      base = tier?.amount ?? 200;
    }
    return Math.round(base * durationMultiplier);
  };

  const totalCommission = useMemo(() => {
    return completedDeals.reduce((sum, d) => sum + calculateCommission(d), 0);
  }, [completedDeals, commissionType, commissionConfig]);

  if (loading || !user) return null;

  const navigateToPage = (page: string) => navigate("/admin", { state: { page } });

  const summaryCards = [
    { label: "Available Rooms", value: availableRooms.length, icon: BedDouble, color: "text-emerald-500", bg: "bg-emerald-500/10", tab: "availableRooms" },
    { label: "Submitted Bookings", value: submittedBookings.length, icon: ClipboardList, color: "text-amber-500", bg: "bg-amber-500/10", tab: "myBookings" },
    { label: "Ready for Move-in", value: readyForMoveIn.length, icon: LogIn, color: "text-blue-500", bg: "bg-blue-500/10", tab: "myMoveIns" },
    { label: "Submitted Move-ins", value: submittedMoveIns.length, icon: LogIn, color: "text-orange-500", bg: "bg-orange-500/10", tab: "myMoveIns" },
    { label: "My Deals", value: completedDeals.length, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", tab: "myDeals" },
    { label: "My Earnings", value: `RM ${totalCommission.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10", tab: "earnings" },
  ];

  const quickActions = [
    { label: "Browse Available Rooms", icon: Search, tab: "availableRooms" },
    { label: "Submit Booking", icon: Plus, tab: "myBookings" },
    { label: "Submit Move-in", icon: Upload, tab: "myMoveIns" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgentSidebar activeTab="dashboard" onTabChange={(tab) => navigateToPage(tab)} />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1 p-8">
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-extrabold">Agent Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {summaryCards.map(card => (
                  <StatCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    iconColor={card.color}
                    iconBg={card.bg}
                    onClick={() => navigateToPage(card.tab)}
                  />
                ))}
              </div>

              <div className="bg-card rounded-lg border p-5">
                <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {quickActions.map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => navigateToPage(action.tab)}
                    >
                      <action.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-lg border overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h2 className="font-semibold text-foreground">Pipeline Summary</h2>
                </div>
                <div className="p-5 text-sm text-muted-foreground space-y-2">
                  <p>📋 <strong className="text-foreground">Submitted Bookings</strong> — Waiting for admin to review.</p>
                  <p>🏠 <strong className="text-foreground">Ready for Move-in</strong> — Booking approved, bring tenant to move in.</p>
                  <p>🔍 <strong className="text-foreground">Submitted Move-ins</strong> — Move-in submitted, waiting for admin approval.</p>
                  <p>✅ <strong className="text-foreground">My Deals</strong> — Completed deals with approved move-ins.</p>
                  <p>💰 <strong className="text-foreground">My Earnings</strong> — Auto-calculated from all completed deals.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

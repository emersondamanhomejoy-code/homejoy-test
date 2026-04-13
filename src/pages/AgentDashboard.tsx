import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBookings } from "@/hooks/useBookings";
import { useMoveIns } from "@/hooks/useMoveIns";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { useState } from "react";

interface CommissionConfig {
  percentage?: number;
  tiers?: { min: number; max: number | null; amount?: number; percentage?: number }[];
}

function PipelineCard({ label, value, color, size, highlight, onClick }: {
  label: string; value: string | number; color: string; size: string; highlight?: boolean; onClick?: () => void;
}) {
  const isSmall = size === "small";
  const isMedium = size === "medium";

  if (isSmall) {
    return (
      <div onClick={onClick} className="bg-muted/50 rounded-lg p-3 border border-border cursor-pointer hover:bg-muted transition-all">
        <div className={`text-xs font-semibold ${color} mb-1`}>{label}</div>
        <div className="text-xl font-semibold text-muted-foreground tabular-nums">{value}</div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={`rounded-xl shadow-sm border cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${
      highlight 
        ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900" 
        : "bg-card border-border"
    } ${isMedium ? "p-4" : "p-5"}`}>
      <div className={`text-xs font-semibold ${color} mb-2`}>{label}</div>
      <div className={`font-bold tabular-nums ${
        highlight ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
      } ${isMedium ? "text-2xl" : "text-4xl"}`}>
        {value}
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { data: allBookings = [] } = useBookings();
  const { data: allMoveIns = [] } = useMoveIns();

  const [commissionType, setCommissionType] = useState("internal_basic");
  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    } else if (!loading && user && role && role !== "agent") {
      navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("commission_type, commission_config").eq("user_id", user.id).eq("role", "agent").single()
      .then(({ data }) => {
        if (data?.commission_type) setCommissionType(data.commission_type);
        if (data?.commission_config) setCommissionConfig(data.commission_config as CommissionConfig);
      });
  }, [user]);

  // My bookings
  const myBookings = useMemo(() => allBookings.filter(b => b.submitted_by === user?.id), [allBookings, user?.id]);
  const myBookingIds = useMemo(() => new Set(myBookings.map(b => b.id)), [myBookings]);

  // My move-ins (linked to my bookings)
  const myMoveIns = useMemo(() => allMoveIns.filter(m => m.booking_id && myBookingIds.has(m.booking_id)), [allMoveIns, myBookingIds]);

  // Stats
  const bookingSubmitted = useMemo(() => myBookings.filter(b => b.status === "pending").length, [myBookings]);
  const bookingRejected = useMemo(() => myBookings.filter(b => b.status === "rejected").length, [myBookings]);
  
  // Pending move-in = approved bookings that don't have a move-in yet
  const moveInBookingIds = useMemo(() => new Set(myMoveIns.map(m => m.booking_id)), [myMoveIns]);
  const pendingMoveIn = useMemo(() => myBookings.filter(b => b.status === "approved" && !moveInBookingIds.has(b.id)).length, [myBookings, moveInBookingIds]);
  
  const moveInPendingReview = useMemo(() => myMoveIns.filter(m => m.status === "pending_review").length, [myMoveIns]);
  const moveInRejected = useMemo(() => myMoveIns.filter(m => m.status === "rejected").length, [myMoveIns]);
  const completedDeals = useMemo(() => myMoveIns.filter(m => m.status === "approved"), [myMoveIns]);

  const calculateCommission = (moveIn: any): number => {
    const booking = allBookings.find(b => b.id === moveIn.booking_id);
    if (!booking) return 0;
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
  }, [completedDeals, commissionType, commissionConfig, allBookings]);

  if (loading || !user) return null;

  const navigateToPage = (page: string) => navigate("/admin", { state: { page } });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgentSidebar activeTab="dashboard" onTabChange={(tab) => navigate("/admin", { state: { page: tab } })} />
        <div className="flex-1 flex flex-col">

          {/* Announcement Banner */}
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-8 py-3 border-b border-border">
            <p className="text-center text-sm font-medium text-foreground">
              📢 New commission structure effective from 1st July 2025.{" "}
              <a href="#" className="text-primary underline">Learn More</a>
            </p>
          </div>

          {/* Main Content */}
          <main className="flex-1 p-8 overflow-auto">
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Agent Dashboard</h2>
                <p className="text-muted-foreground text-sm mt-1">Track your pipeline from booking to commission.</p>
              </div>

              {/* Pipeline Grid */}
              <div className="space-y-4">
                {/* Top row */}
                <div className="grid grid-cols-4 gap-4">
                  <PipelineCard label="Booking Submitted" value={bookingSubmitted} color="text-blue-500" size="large" onClick={() => navigateToPage("myBookings")} />
                  <PipelineCard label="Pending Move-in" value={pendingMoveIn} color="text-amber-500" size="large" onClick={() => navigateToPage("myMoveIns")} />
                  <PipelineCard label="My Deals" value={completedDeals.length} color="text-emerald-500" size="large" onClick={() => navigateToPage("myDeals")} />
                  <PipelineCard label="Total Commission" value={`RM ${totalCommission.toLocaleString()}`} color="text-emerald-600" size="large" highlight onClick={() => navigateToPage("myDeals")} />
                </div>

                {/* Second row */}
                <div className="grid grid-cols-4 gap-4">
                  <PipelineCard label="Booking Rejected" value={bookingRejected} color="text-destructive" size="small" onClick={() => navigateToPage("myBookings")} />
                  <PipelineCard label="Move-in Pending Review" value={moveInPendingReview} color="text-amber-500" size="small" onClick={() => navigateToPage("myMoveIns")} />
                </div>

                {/* Third row */}
                <div className="grid grid-cols-4 gap-4">
                  <div /> {/* spacer */}
                  <PipelineCard label="Move-in Rejected" value={moveInRejected} color="text-destructive" size="small" onClick={() => navigateToPage("myMoveIns")} />
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Pipeline Summary</h3>
                </div>
                <div className="p-6 text-sm text-muted-foreground space-y-2">
                  <p>📋 <strong>Booking Submitted</strong> — Waiting for admin to review your booking.</p>
                  <p>⏳ <strong>Pending Move-in</strong> — Booking approved. Submit move-in completion.</p>
                  <p>🔍 <strong>Move-in Pending Review</strong> — Move-in submitted, waiting for admin approval.</p>
                  <p>✅ <strong>My Deals</strong> — Completed deals with approved move-ins.</p>
                  <p>💰 <strong>Total Commission</strong> — Auto-calculated from all completed deals.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

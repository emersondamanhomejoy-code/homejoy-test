import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/AgentSidebar";

const navigateToOld = (navigate: ReturnType<typeof useNavigate>, page = "dashboard") => {
  navigate("/admin", { state: { page } });
};

const pipelineData = {
  booking: [
    { label: "Submitted", value: 5, color: "text-blue-500", size: "large" },
    { label: "Rejected", value: 2, color: "text-destructive", size: "small" },
  ],
  movein: [
    { label: "Pending Move-in", value: 3, color: "text-amber-500", size: "large" },
    { label: "Pending Review", value: 1, color: "text-amber-500", size: "medium" },
    { label: "Rejected", value: 0, color: "text-destructive", size: "small" },
  ],
  claim: [
    { label: "Claimable", value: 2, color: "text-teal-500", size: "large" },
    { label: "Pending Review", value: 1, color: "text-teal-500", size: "medium" },
    { label: "Rejected", value: 0, color: "text-destructive", size: "small" },
  ],
  result: [
    { label: "My Deals", value: 12, color: "text-emerald-500", size: "large" },
    { label: "Total Commission", value: "RM 3,400", color: "text-emerald-600", size: "large", highlight: true },
  ],
};

const notifications = [
  { message: "Booking #1023 has been approved", time: "2 minutes ago", type: "success" },
  { message: "Move-in #887 rejected — reason: incomplete docs", time: "1 hour ago", type: "error" },
  { message: "Claim #445 approved — RM 200 credited", time: "3 hours ago", type: "success" },
  { message: "📢 Announcement: New parking policy starts next month", time: "Yesterday", type: "info" },
];

const dotColor: Record<string, string> = {
  success: "bg-emerald-400",
  error: "bg-destructive",
  info: "bg-primary",
};

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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    } else if (!loading && user && role && role !== "agent") {
      navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  if (loading || !user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgentSidebar />
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
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(pipelineData).map(([key, cards]) => (
                  <div key={key} className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {key === "movein" ? "Move-in" : key.charAt(0).toUpperCase() + key.slice(1)}
                    </div>
                    {cards.map((card, i) => (
                      <PipelineCard key={i} {...card} onClick={
                        key === "claim" ? () => navigateToOld(navigate, "claims") :
                        key === "booking" ? () => navigateToOld(navigate) :
                        undefined
                      } />
                    ))}
                  </div>
                ))}
              </div>

              {/* Notifications */}
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-semibold text-foreground">Notifications & Updates</h3>
                  <span className="text-xs text-primary cursor-pointer hover:underline">View All</span>
                </div>
                <div className="divide-y divide-border">
                  {notifications.map((n, i) => (
                    <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/50 cursor-pointer">
                      <div className={`w-2 h-2 ${dotColor[n.type]} rounded-full shrink-0`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{n.message}</div>
                        <div className="text-xs text-muted-foreground">{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

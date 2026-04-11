import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { useAuth } from "@/hooks/useAuth";

export function OldDashboardLayout({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "boss" || role === "manager";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {isAdmin ? <AdminSidebar /> : <AgentSidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AgentSidebar } from "@/components/AgentSidebar";
import { useAuth } from "@/hooks/useAuth";

interface OldDashboardLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** Agent page state for highlighting sidebar */
  agentTab?: string;
  onAgentTabChange?: (tab: string) => void;
}

export function OldDashboardLayout({ children, activeTab, onTabChange, agentTab, onAgentTabChange }: OldDashboardLayoutProps) {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {isAdmin
          ? <AdminSidebar activeTab={activeTab} onTabChange={onTabChange} />
          : <AgentSidebar activeTab={agentTab} onTabChange={onAgentTabChange} />
        }
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

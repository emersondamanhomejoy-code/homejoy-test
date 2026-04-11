import {
  LayoutDashboard, Users, DollarSign, FileText, LogOut,
  PanelLeftClose, PanelLeft, Sparkles, Building2, ClipboardList
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { title: "Units & Rooms", icon: Building2, tab: "units" },
  { title: "Bookings", icon: ClipboardList, tab: "bookings", link: "/" },
  { title: "Claims", icon: DollarSign, tab: "claims" },
  { title: "Users", icon: Users, tab: "users" },
  { title: "Activity Log", icon: FileText, tab: "activity", bossOnly: true },
];

interface AdminSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function AdminSidebar({ activeTab = "dashboard", onTabChange }: AdminSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();
  const canViewActivityLog = role === "boss" || role === "manager";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const visibleItems = adminMenuItems.filter(
    (item) => !item.bossOnly || canViewActivityLog
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-6 ${collapsed ? "px-2 py-4" : ""} flex items-center justify-between`}>
          {collapsed ? (
            <button onClick={toggleSidebar} className="w-full flex justify-center text-muted-foreground hover:text-foreground transition-colors">
              <PanelLeft className="h-5 w-5" />
            </button>
          ) : (
            <>
              <h1 className="font-bold text-primary text-xl">HOMEJOY</h1>
              <button onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && "Admin Panel"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={() => onTabChange?.(item.tab)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                        activeTab === item.tab
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="hover:bg-muted/50 text-muted-foreground">
                <Sparkles className="h-4 w-4 mr-2" />
                {!collapsed && <span>Agent Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a className="cursor-pointer hover:bg-muted/50" onClick={handleLogout} role="button">
                <LogOut className="h-4 w-4 mr-2" />
                {!collapsed && <span>Logout</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && user && (
          <div className="px-3 pb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
              {(role || "A")[0].toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-foreground capitalize">{role}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

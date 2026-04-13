import {
  LayoutDashboard, Home, LogOut, PanelLeftClose, PanelLeft,
  ClipboardList, LogIn, Trophy, User, Wallet, Megaphone
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

interface AgentMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url?: string;
  tab?: string;
}

const menuItems: AgentMenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Available Rooms", icon: Home, url: "/rooms" },
  { title: "My Bookings", icon: ClipboardList, tab: "myBookings" },
  { title: "Move In", icon: LogIn, tab: "myMoveIns" },
  { title: "My Deals", icon: Trophy, tab: "myDeals" },
  { title: "Earnings", icon: Wallet, tab: "earnings" },
  { title: "Announcements", icon: Megaphone, tab: "announcements" },
  { title: "Profile", icon: User, tab: "myAccount" },
];

interface AgentSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function AgentSidebar({ activeTab, onTabChange }: AgentSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

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
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.url ? (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    ) : (
                      <button
                        onClick={() => onTabChange?.(item.tab!)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                          activeTab === item.tab
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </button>
                    )}
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
              A
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Agent</div>
              <div className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

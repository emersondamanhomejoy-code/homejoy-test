import { LayoutDashboard, Home, ClipboardList, DollarSign, Settings, LogOut, ExternalLink, PanelLeftClose, PanelLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Rooms", url: "/rooms", icon: Home },
  { title: "Bookings", url: "/bookings", icon: ClipboardList },
  { title: "Claims", url: "/claims", icon: DollarSign },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AgentSidebar() {
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
                    <NavLink
                      to={item.url}
                      end={item.url === "/agent"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
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
              <NavLink to="/old" className="hover:bg-muted/50 text-muted-foreground">
                <ExternalLink className="h-4 w-4 mr-2" />
                {!collapsed && <span>Old Version</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a className="cursor-pointer hover:bg-muted/50" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                {!collapsed && <span>Logout</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="px-3 pb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
              A
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Agent Name</div>
              <div className="text-xs text-muted-foreground">agent@email.com</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

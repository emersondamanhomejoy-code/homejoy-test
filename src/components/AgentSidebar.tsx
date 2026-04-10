import { LayoutDashboard, Home, ClipboardList, DollarSign, Settings, LogOut, ExternalLink } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-6 ${collapsed ? "px-2" : ""}`}>
          <h1 className={`font-bold text-primary ${collapsed ? "text-xs text-center" : "text-xl"}`}>
            {collapsed ? "HJ" : "HOMEJOY"}
          </h1>
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
              <a className="cursor-pointer hover:bg-muted/50">
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Sign from "./pages/Sign.tsx";
import SetPassword from "./pages/SetPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import RoomPhotos from "./pages/RoomPhotos.tsx";
import CommonPhotos from "./pages/CommonPhotos.tsx";
import BuildingPhotos from "./pages/BuildingPhotos.tsx";
import NotFound from "./pages/NotFound.tsx";
import AgentDashboard from "./pages/AgentDashboard.tsx";
import Login from "./pages/Login.tsx";
import Rooms from "./pages/Rooms.tsx";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<AgentDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/admin" element={<Index />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/sign/:token" element={<Sign />} />
           <Route path="/photos/:roomId" element={<RoomPhotos />} />
           <Route path="/common/:unitId" element={<CommonPhotos />} />
           <Route path="/building-photos/:condoId" element={<BuildingPhotos />} />
           
            <Route path="*" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

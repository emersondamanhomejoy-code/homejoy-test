import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UnitData {
  id: string;
  building: string;
  unit: string;
  location: string;
  unit_type: string;
  unit_max_pax: number;
  passcode: string;
  wifi_name: string;
  wifi_password: string;
  meter_type: string;
  meter_rate: number;
  deposit_multiplier: number;
  admin_fee: number;
  common_photos: string[];
  internal_only: boolean;
  access_info: any;
}

interface RoomData {
  id: string;
  room: string;
  room_title: string;
  rent: number;
  bed_type: string;
  room_type: string;
  status: string;
  available_date: string;
  max_pax: number;
  pax_staying: number;
  photos: string[];
  optional_features: string[];
  wall_type: string;
}

interface CondoData {
  name: string;
  address: string;
  gps_link: string;
  amenities: string;
  parking_info: string;
  arrival_instruction: string;
  description: string;
  photos: string[];
  visitor_car_parking: string;
  visitor_motorcycle_parking: string;
}

export default function PublicUnitView() {
  const { unitId } = useParams<{ unitId: string }>();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const section = searchParams.get("section"); // "condo", "unit", "room"

  const [unit, setUnit] = useState<UnitData | null>(null);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [condo, setCondo] = useState<CondoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!unitId) return;
    (async () => {
      try {
        const { data: unitData, error: uErr } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();
        if (uErr || !unitData) { setError("Unit not found"); setLoading(false); return; }
        setUnit(unitData as unknown as UnitData);

        const { data: roomsData } = await supabase
          .from("rooms")
          .select("id, room, room_title, rent, bed_type, room_type, status, available_date, max_pax, pax_staying, photos, optional_features, wall_type")
          .eq("unit_id", unitId)
          .order("room", { ascending: true });
        setRooms((roomsData || []) as unknown as RoomData[]);

        const { data: condoData } = await supabase
          .from("condos")
          .select("*")
          .eq("name", (unitData as any).building)
          .single();
        if (condoData) setCondo(condoData as unknown as CondoData);
      } catch { setError("Failed to load data"); }
      setLoading(false);
    })();
  }, [unitId]);

  useEffect(() => {
    if (!loading && section) {
      setTimeout(() => {
        document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [loading, section]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );

  if (error || !unit) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Not Found</h1>
        <p className="text-muted-foreground">{error || "This unit does not exist."}</p>
      </div>
    </div>
  );

  const displayRooms = rooms.filter(r => r.room_type !== "Car Park" && !(r.room || "").toLowerCase().startsWith("carpark"));
  const selectedRoom = roomId ? displayRooms.find(r => r.id === roomId) : null;

  const photoUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/room-photos/${path}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{unit.building}</h1>
          <p className="text-muted-foreground">{unit.unit} · {unit.location}</p>
        </div>

        {/* Section 1: Condo / Common Area */}
        <section id="section-condo" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground border-b pb-2">Building & Common Area</h2>
          {condo && (
            <div className="space-y-3 text-sm">
              {condo.address && <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{condo.address}</span></div>}
              {condo.gps_link && <div><span className="text-muted-foreground">GPS:</span> <a href={condo.gps_link} target="_blank" rel="noreferrer" className="text-primary underline">{condo.gps_link}</a></div>}
              {condo.amenities && <div><span className="text-muted-foreground">Amenities:</span> <span className="font-medium">{condo.amenities}</span></div>}
              {condo.parking_info && <div><span className="text-muted-foreground">Parking:</span> <span className="font-medium">{condo.parking_info}</span></div>}
              {condo.visitor_car_parking && <div><span className="text-muted-foreground">Visitor Car Parking:</span> <span className="font-medium">{condo.visitor_car_parking}</span></div>}
              {condo.visitor_motorcycle_parking && <div><span className="text-muted-foreground">Visitor Motorcycle Parking:</span> <span className="font-medium">{condo.visitor_motorcycle_parking}</span></div>}
              {condo.arrival_instruction && <div><span className="text-muted-foreground">Arrival Instructions:</span> <span className="font-medium">{condo.arrival_instruction}</span></div>}
              {condo.description && <div><span className="text-muted-foreground">Description:</span> <span className="font-medium">{condo.description}</span></div>}
            </div>
          )}
          {/* Condo photos */}
          {Array.isArray(condo?.photos) && condo.photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(condo.photos as string[]).map((path, i) => (
                <img key={i} src={photoUrl(path)} alt={`Condo ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-lg border" />
              ))}
            </div>
          )}
          {/* Common area photos */}
          {Array.isArray(unit.common_photos) && unit.common_photos.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-muted-foreground">Common Area Photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {unit.common_photos.map((path, i) => (
                  <img key={i} src={photoUrl(path)} alt={`Common ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-lg border" />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Section 2: Unit Details */}
        <section id="section-unit" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground border-b pb-2">Unit Details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium">{unit.unit}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{unit.unit_type}</span></div>
            <div><span className="text-muted-foreground">Max Occupants:</span> <span className="font-medium">{unit.unit_max_pax}</span></div>
          </div>
        </section>

        {/* Section 3: Room Details */}
        <section id="section-room" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground border-b pb-2">
            {selectedRoom ? `Room ${selectedRoom.room.replace(/^Room\s+/i, "")}` : "Available Rooms"}
          </h2>
          {(selectedRoom ? [selectedRoom] : displayRooms).map(room => (
            <div key={room.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Room {room.room.replace(/^Room\s+/i, "")} {room.room_title ? `— ${room.room_title}` : ""}</h3>
                <span className={`text-sm px-2 py-0.5 rounded-full ${room.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {room.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Rental:</span> <span className="font-medium">RM{room.rent}/month</span></div>
                <div><span className="text-muted-foreground">Bed:</span> <span className="font-medium">{room.bed_type || "—"}</span></div>
                <div><span className="text-muted-foreground">Max Pax:</span> <span className="font-medium">{room.max_pax}</span></div>
                {room.wall_type && <div><span className="text-muted-foreground">Wall:</span> <span className="font-medium">{room.wall_type}</span></div>}
                {Array.isArray(room.optional_features) && room.optional_features.length > 0 && (
                  <div className="col-span-2"><span className="text-muted-foreground">Features:</span> <span className="font-medium">{room.optional_features.join(", ")}</span></div>
                )}
              </div>
              {/* Room photos */}
              {Array.isArray(room.photos) && room.photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(room.photos as string[]).map((path, i) => (
                    <img key={i} src={photoUrl(path)} alt={`Room ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-lg border" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Powered by Homejoy
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";

interface RoomData {
  id: string;
  building: string;
  unit: string;
  room: string;
  room_type: string;
  rent: number;
  bed_type: string;
  photos: string[];
  unit_id: string | null;
}

interface UnitData {
  common_photos: string[];
}

const STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos`;

export default function RoomPhotos() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [commonPhotos, setCommonPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      setLoading(true);
      const { data: roomData, error: rErr } = await supabase
        .from("rooms")
        .select("id, building, unit, room, room_type, rent, bed_type, photos, unit_id")
        .eq("id", roomId)
        .single();
      if (rErr || !roomData) {
        setError("Room not found");
        setLoading(false);
        return;
      }
      const r = roomData as unknown as RoomData;
      setRoom(r);

      if (r.unit_id) {
        const { data: unitData } = await supabase
          .from("units")
          .select("common_photos")
          .eq("id", r.unit_id)
          .single();
        if (unitData) {
          setCommonPhotos(((unitData as unknown as UnitData).common_photos || []) as string[]);
        }
      }
      setLoading(false);
    })();
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading photos...</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl">📷</div>
          <div className="text-lg font-semibold text-foreground">Room not found</div>
          <div className="text-sm text-muted-foreground">This link may be invalid or expired.</div>
        </div>
      </div>
    );
  }

  const roomPhotos = (room.photos || []) as string[];
  const allEmpty = roomPhotos.length === 0 && commonPhotos.length === 0;

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos.map(p => `${STORAGE_URL}/${p}`));
    setLightboxIndex(index);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {lightboxIndex !== null && (
        <PhotoLightbox photos={lightboxPhotos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
          <h1 className="text-3xl font-extrabold tracking-tight">{room.building}</h1>
          <div className="text-lg text-muted-foreground">{room.unit} • {room.room}</div>
          <div className="flex justify-center gap-3 mt-3">
            <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">{room.bed_type || room.room_type}</span>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">RM{room.rent}/month</span>
          </div>
        </div>

        {allEmpty ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📷</div>
            <div className="text-lg font-medium">No photos available yet</div>
          </div>
        ) : (
          <>
            {roomPhotos.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">🛏️ Room Photos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {roomPhotos.map((path, i) => (
                    <img
                      key={i}
                      src={`${STORAGE_URL}/${path}`}
                      alt={`Room photo ${i + 1}`}
                      className="w-full h-48 md:h-56 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                      onClick={() => openLightbox(roomPhotos, i)}
                    />
                  ))}
                </div>
              </div>
            )}

            {commonPhotos.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">🏠 Common Area</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {commonPhotos.map((path, i) => (
                    <img
                      key={i}
                      src={`${STORAGE_URL}/${path}`}
                      alt={`Common area ${i + 1}`}
                      className="w-full h-48 md:h-56 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                      onClick={() => openLightbox(commonPhotos, i)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border">
          Powered by Homejoy
        </div>
      </div>
    </div>
  );
}

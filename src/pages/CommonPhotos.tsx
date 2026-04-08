import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UnitData {
  id: string;
  building: string;
  unit: string;
  unit_type: string;
  common_photos: string[];
}

const STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos`;

export default function CommonPhotos() {
  const { unitId } = useParams<{ unitId: string }>();
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("units")
        .select("id, building, unit, unit_type, common_photos")
        .eq("id", unitId)
        .single();
      if (err || !data) {
        setError("Unit not found");
        setLoading(false);
        return;
      }
      setUnit(data as unknown as UnitData);
      setLoading(false);
    })();
  }, [unitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading photos...</div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl">📷</div>
          <div className="text-lg font-semibold text-foreground">Unit not found</div>
          <div className="text-sm text-muted-foreground">This link may be invalid or expired.</div>
        </div>
      </div>
    );
  }

  const photos = (unit.common_photos || []) as string[];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-70">✕</button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Homejoy</div>
          <h1 className="text-3xl font-extrabold tracking-tight">{unit.building}</h1>
          <div className="text-lg text-muted-foreground">{unit.unit}</div>
          <span className="inline-block px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mt-2">{unit.unit_type}</span>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📷</div>
            <div className="text-lg font-medium">No common area photos available yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">🏠 Common Area Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((path, i) => (
                <img
                  key={i}
                  src={`${STORAGE_URL}/${path}`}
                  alt={`Common area ${i + 1}`}
                  className="w-full h-48 md:h-56 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                  onClick={() => setLightbox(`${STORAGE_URL}/${path}`)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border">
          Powered by Homejoy
        </div>
      </div>
    </div>
  );
}

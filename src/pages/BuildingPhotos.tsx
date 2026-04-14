import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CondoData {
  id: string;
  name: string;
  photos: string[];
}

const STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/room-photos`;

export default function BuildingPhotos() {
  const { condoId } = useParams<{ condoId: string }>();
  const [condo, setCondo] = useState<CondoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!condoId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("condos")
        .select("id, name, photos")
        .eq("id", condoId)
        .single();
      if (err || !data) {
        setError("Building not found");
        setLoading(false);
        return;
      }
      setCondo({
        ...data,
        photos: Array.isArray(data.photos) ? (data.photos as string[]) : [],
      });
      setLoading(false);
    })();
  }, [condoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading photos...</div>
      </div>
    );
  }

  if (error || !condo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl">📷</div>
          <div className="text-lg font-semibold text-foreground">Building not found</div>
          <div className="text-sm text-muted-foreground">This link may be invalid or expired.</div>
        </div>
      </div>
    );
  }

  const photos = condo.photos;

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
          <h1 className="text-3xl font-extrabold tracking-tight">{condo.name}</h1>
          <div className="text-lg text-muted-foreground">Building Photos</div>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">📷</div>
            <div className="text-lg font-medium">No building photos available yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((path, i) => (
                <img
                  key={i}
                  src={`${STORAGE_URL}/${path}`}
                  alt={`Building photo ${i + 1}`}
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

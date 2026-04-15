import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const photos = (unit?.common_photos || []) as string[];

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % photos.length);
  }, [lightboxIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
  }, [lightboxIndex, photos.length]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          {/* Close */}
          <button onClick={closeLightbox} className="absolute top-4 right-4 text-white/80 hover:text-white z-10">
            <X className="h-7 w-7" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 z-10"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={`${STORAGE_URL}/${photos[lightboxIndex]}`}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {photos.length > 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 z-10"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
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
            <div className="text-lg font-medium">No unit photos available yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">🏠 Unit Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((path, i) => (
                <img
                  key={i}
                  src={`${STORAGE_URL}/${path}`}
                  alt={`Unit photo ${i + 1}`}
                  className="w-full h-48 md:h-56 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                  onClick={() => setLightboxIndex(i)}
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

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoLightboxProps {
  photos: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export function PhotoLightbox({ photos, index, onClose, onIndexChange }: PhotoLightboxProps) {
  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center pointer-events-auto"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={photos[index]}
        alt={`Photo ${index + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {index + 1} / {photos.length}
      </div>
    </div>,
    document.body
  );
}

---
name: Photo lightbox standards
description: Use createPortal + z-[100] + bg-black/95 for all photo lightbox/viewer overlays with keyboard nav
type: design
---
When displaying a photo lightbox/viewer overlay:

1. **Render via `createPortal(…, document.body)`** — never inside a modal, to avoid parent styling bleed-through.
2. **z-index**: `z-[100]` to sit above all modals and dialogs.
3. **Background**: `bg-black/95` for a clean full-screen dark overlay.
4. **Navigation**: Mouse click buttons (‹ ›) AND keyboard Left/Right arrows.
5. **Close**: ✕ button top-right, click backdrop, AND Escape key.
6. **Counter**: Show `{current} / {total}` at the bottom center.
7. **Keyboard `useEffect`**:
```tsx
useEffect(() => {
  if (lightboxIndex === null) return;
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setLightboxIndex(null);
    if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
    if (e.key === "ArrowRight" && lightboxIndex < photoCount - 1) setLightboxIndex(lightboxIndex + 1);
  };
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [lightboxIndex, photoCount]);
```

8. **Image**: `max-h-[90vh] max-w-[90vw] object-contain rounded-lg`

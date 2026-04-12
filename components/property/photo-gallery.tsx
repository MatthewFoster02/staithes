"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GridIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { propertyPhotoUrl } from "@/lib/storage/photos";

export interface GalleryPhoto {
  id: string;
  url: string;
  altText: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  exterior: "Exterior",
  living: "Living areas",
  kitchen: "Kitchen",
  bedroom: "Bedrooms",
  bathroom: "Bathrooms",
  garden: "Garden",
  other: "Other",
};

const CATEGORY_ORDER = [
  "exterior",
  "living",
  "kitchen",
  "bedroom",
  "bathroom",
  "garden",
  "other",
];

type Mode = "grid" | "lightbox";

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("grid");
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  const featured = photos.slice(0, 5);
  const [hero, ...rest] = featured;

  const grouped = React.useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      photos: photos
        .map((p, globalIndex) => ({ photo: p, globalIndex }))
        .filter(({ photo }) => photo.category === cat),
    })).filter((g) => g.photos.length > 0);
  }, [photos]);

  const openLightbox = React.useCallback((index: number) => {
    setLightboxIndex(index);
    setMode("lightbox");
    setOpen(true);
  }, []);

  const openGalleryGrid = React.useCallback(() => {
    setMode("grid");
    setOpen(true);
  }, []);

  if (photos.length === 0) return null;

  return (
    <>
      <HeroGrid hero={hero} rest={rest} onPhotoClick={openLightbox} onShowAll={openGalleryGrid} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed inset-0 top-0 left-0 z-50 grid h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 overflow-y-auto rounded-none bg-background p-0 ring-0 sm:max-w-none"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {mode === "grid"
              ? "All photos of the property"
              : `Photo ${lightboxIndex + 1} of ${photos.length}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "grid"
              ? "Browse all photos of the property, grouped by area."
              : "Use the arrow keys, on-screen buttons, or swipe to navigate between photos. Press Escape to close."}
          </DialogDescription>

          <GalleryHeader
            mode={mode}
            currentIndex={lightboxIndex}
            total={photos.length}
            onBackToGrid={() => setMode("grid")}
            onClose={() => setOpen(false)}
          />

          {mode === "grid" ? (
            <GalleryGridView grouped={grouped} onPhotoClick={openLightbox} />
          ) : (
            <LightboxView
              photos={photos}
              startIndex={lightboxIndex}
              onIndexChange={setLightboxIndex}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function HeroGrid({
  hero,
  rest,
  onPhotoClick,
  onShowAll,
}: {
  hero: GalleryPhoto | undefined;
  rest: GalleryPhoto[];
  onPhotoClick: (index: number) => void;
  onShowAll: () => void;
}) {
  if (!hero) return null;

  return (
    <div className="relative">
      {/* Mobile: single hero photo */}
      <button
        type="button"
        onClick={() => onPhotoClick(0)}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl md:hidden"
        aria-label={`Open photo: ${hero.altText}`}
      >
        <Image
          src={propertyPhotoUrl(hero.url)}
          alt={hero.altText}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </button>

      {/* Desktop: 1 large + 4 small grid */}
      <div className="hidden aspect-[16/9] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:grid">
        <button
          type="button"
          onClick={() => onPhotoClick(0)}
          className="group relative col-span-2 row-span-2 overflow-hidden"
          aria-label={`Open photo: ${hero.altText}`}
        >
          <Image
            src={propertyPhotoUrl(hero.url)}
            alt={hero.altText}
            fill
            priority
            sizes="50vw"
            className="object-cover transition group-hover:brightness-90"
          />
        </button>
        {rest.map((photo, idx) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onPhotoClick(idx + 1)}
            className="group relative overflow-hidden"
            aria-label={`Open photo: ${photo.altText}`}
          >
            <Image
              src={propertyPhotoUrl(photo.url)}
              alt={photo.altText}
              fill
              sizes="25vw"
              className="object-cover transition group-hover:brightness-90"
            />
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onShowAll}
        className="absolute right-4 bottom-4 bg-white shadow-md hover:bg-neutral-50"
      >
        <GridIcon className="size-4" />
        Show all photos
      </Button>
    </div>
  );
}

function GalleryHeader({
  mode,
  currentIndex,
  total,
  onBackToGrid,
  onClose,
}: {
  mode: Mode;
  currentIndex: number;
  total: number;
  onBackToGrid: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-background/90 px-4 py-3 backdrop-blur-md">
      {mode === "lightbox" ? (
        <Button variant="ghost" size="sm" onClick={onBackToGrid}>
          <ArrowLeftIcon className="size-4" />
          All photos
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
      )}

      {mode === "lightbox" ? (
        <span className="text-sm font-medium tabular-nums text-neutral-600">
          {currentIndex + 1} / {total}
        </span>
      ) : (
        <span className="text-sm font-medium text-neutral-700">All photos</span>
      )}

      <Button variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

function GalleryGridView({
  grouped,
  onPhotoClick,
}: {
  grouped: { key: string; label: string; photos: { photo: GalleryPhoto; globalIndex: number }[] }[];
  onPhotoClick: (index: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {grouped.map((group) => (
        <section key={group.key} className="mb-10">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">{group.label}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {group.photos.map(({ photo, globalIndex }) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPhotoClick(globalIndex)}
                className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100"
                aria-label={`Open photo: ${photo.altText}`}
              >
                <Image
                  src={propertyPhotoUrl(photo.url)}
                  alt={photo.altText}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition group-hover:brightness-90"
                />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LightboxView({
  photos,
  startIndex,
  onIndexChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  startIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const total = photos.length;
  const [index, setIndex] = React.useState(startIndex);

  // Sync external startIndex changes (e.g. opening from a different photo).
  React.useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  // Bubble the current index back up so the header counter stays in sync.
  React.useEffect(() => {
    onIndexChange(index);
  }, [index, onIndexChange]);

  const goNext = React.useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  const goPrev = React.useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  // Keyboard navigation: ← / → cycle through photos. Escape is handled
  // by the Dialog component itself (closes the modal).
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch swipe.
  const touchStartX = React.useRef<number | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const photo = photos[index];
  if (!photo) return null;

  // Click anywhere on the dark background closes the lightbox. The
  // image and chevron buttons stop propagation so they don't trigger
  // a close on click.
  return (
    <div
      className="relative flex items-center justify-center bg-black"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="presentation"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          goPrev();
        }}
        className="absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-md transition hover:bg-white sm:left-6 sm:size-12"
        aria-label="Previous photo"
      >
        <ChevronLeftIcon className="size-5 sm:size-6" />
      </button>

      <div
        className="relative mx-auto flex h-full max-h-[calc(100vh-8rem)] w-full max-w-5xl items-center justify-center px-4 py-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={propertyPhotoUrl(photo.url)}
            alt={photo.altText}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
        <p className="absolute -bottom-1 left-0 right-0 px-4 text-center text-sm text-neutral-300">
          {photo.altText}
        </p>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          goNext();
        }}
        className="absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-md transition hover:bg-white sm:right-6 sm:size-12"
        aria-label="Next photo"
      >
        <ChevronRightIcon className="size-5 sm:size-6" />
      </button>
    </div>
  );
}

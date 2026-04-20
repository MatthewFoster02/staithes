"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface PropertyPhotoItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  altText: string;
  category: string;
  caption: string | null;
  sortOrder: number;
}

const CATEGORY_OPTIONS = ["exterior", "living", "bedroom", "kitchen", "bathroom", "garden", "other"];

const inputClass = "w-full rounded-md border border-neutral-300 px-2 py-1 text-sm";

export function PropertyPhotoManager({ photos }: { photos: PropertyPhotoItem[] }) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("file", file);
      }
      const res = await fetch("/api/admin/property/photos", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
      } else {
        router.refresh();
      }
    } catch {
      setUploadError("Network error.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Photos ({photos.length})</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            onChange={handleUpload}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
          >
            {uploading ? "Uploading…" : "Upload photos"}
          </Button>
        </div>
      </div>
      {uploadError && <p className="mb-3 text-sm text-red-600">{uploadError}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No photos yet. The first photo you upload becomes the hero image.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <PhotoRow key={photo.id} photo={photo} onChange={() => router.refresh()} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Photos are ordered by sort order (lowest first). Click a field to edit
        it — changes save on blur.
      </p>
    </section>
  );
}

function PhotoRow({
  photo,
  onChange,
}: {
  photo: PropertyPhotoItem;
  onChange: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState({
    altText: photo.altText,
    caption: photo.caption ?? "",
    category: photo.category,
    sortOrder: photo.sortOrder,
  });

  async function patch(patchBody: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/property/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
      } else {
        onChange();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete this photo? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/property/photos/${photo.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Delete failed.");
        setBusy(false);
      } else {
        onChange();
      }
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <li className="flex gap-3 rounded-xl border border-neutral-200 p-3">
      <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-md bg-neutral-100">
        <Image
          src={photo.thumbnailUrl}
          alt={photo.altText}
          fill
          sizes="128px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Sort</span>
            <input
              type="number"
              value={values.sortOrder}
              onChange={(e) => setValues((v) => ({ ...v, sortOrder: Number(e.target.value) }))}
              onBlur={() => {
                if (values.sortOrder !== photo.sortOrder) patch({ sortOrder: values.sortOrder });
              }}
              disabled={busy}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Category</span>
            <select
              value={values.category}
              onChange={(e) => {
                setValues((v) => ({ ...v, category: e.target.value }));
                patch({ category: e.target.value });
              }}
              disabled={busy}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-neutral-500">Alt text</span>
          <input
            type="text"
            value={values.altText}
            onChange={(e) => setValues((v) => ({ ...v, altText: e.target.value }))}
            onBlur={() => {
              if (values.altText !== photo.altText && values.altText.trim().length > 0) {
                patch({ altText: values.altText });
              }
            }}
            disabled={busy}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">Caption</span>
          <input
            type="text"
            value={values.caption}
            onChange={(e) => setValues((v) => ({ ...v, caption: e.target.value }))}
            onBlur={() => {
              const next = values.caption.trim() || null;
              const prev = photo.caption ?? null;
              if (next !== prev) patch({ caption: next });
            }}
            disabled={busy}
            className={inputClass}
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={busy}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}

"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { amenityIcon } from "@/lib/property/amenity-icons";

export interface AmenityItem {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  essentials: "Essentials",
  features: "Features",
  safety: "Safety",
  accessibility: "Accessibility",
  outdoor: "Outdoor",
};

const CATEGORY_ORDER = [
  "essentials",
  "features",
  "outdoor",
  "safety",
  "accessibility",
];

const PREVIEW_COUNT = 6;

export function PropertyAmenities({ amenities }: { amenities: AmenityItem[] }) {
  const preview = amenities.slice(0, PREVIEW_COUNT);
  const hasMore = amenities.length > PREVIEW_COUNT;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: amenities.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  if (amenities.length === 0) return null;

  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {preview.map((amenity) => (
          <AmenityRow key={amenity.id} amenity={amenity} />
        ))}
      </ul>

      {hasMore && (
        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline">
                Show all {amenities.length} amenities
              </Button>
            }
          />
          <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>What this place offers</DialogTitle>
              <DialogDescription className="sr-only">
                A grouped list of all amenities available at the property.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {grouped.map((group) => (
                <section key={group.key}>
                  <h3 className="mb-3 text-sm font-semibold tracking-tight text-neutral-900">
                    {group.label}
                  </h3>
                  <ul className="space-y-3">
                    {group.items.map((amenity) => (
                      <AmenityRow key={amenity.id} amenity={amenity} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AmenityRow({ amenity }: { amenity: AmenityItem }) {
  return (
    <li className="flex items-center gap-3 text-sm text-neutral-800">
      {React.createElement(amenityIcon(amenity.icon), {
        className: "size-5 shrink-0 text-neutral-600",
        "aria-hidden": true,
      })}
      <span>{amenity.name}</span>
    </li>
  );
}

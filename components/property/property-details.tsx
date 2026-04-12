import * as React from "react";
import { BedDouble, Bath, Users, BedSingle, type LucideIcon } from "lucide-react";

interface PropertyDetailsProps {
  bedrooms: number;
  beds: number;
  bathrooms: number;
  maxGuests: number;
}

interface DetailItem {
  icon: LucideIcon;
  count: number;
  label: string;
}

export function PropertyDetails({
  bedrooms,
  beds,
  bathrooms,
  maxGuests,
}: PropertyDetailsProps) {
  const items: DetailItem[] = [
    { icon: Users, count: maxGuests, label: maxGuests === 1 ? "guest" : "guests" },
    { icon: BedDouble, count: bedrooms, label: bedrooms === 1 ? "bedroom" : "bedrooms" },
    { icon: BedSingle, count: beds, label: beds === 1 ? "bed" : "beds" },
    { icon: Bath, count: bathrooms, label: bathrooms === 1 ? "bathroom" : "bathrooms" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3"
        >
          {React.createElement(item.icon, {
            className: "size-5 text-neutral-600",
            "aria-hidden": true,
          })}
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              {item.label}
            </dt>
            <dd className="text-base font-medium text-neutral-900">
              {formatCount(item.count)}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

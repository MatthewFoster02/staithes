"use client";

import * as React from "react";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

// Whole-star (1-5) picker. Could be extended to 0.5 step later but
// for the v1 form this is enough.
export function StarRatingInput({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onClick={() => onChange(n)}
            className={`cursor-pointer text-xl leading-none transition ${
              n <= value ? "text-amber-500" : "text-neutral-300 hover:text-neutral-400"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

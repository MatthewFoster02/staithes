"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const TRUNCATE_THRESHOLD = 320;

export function PropertyDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = description.length > TRUNCATE_THRESHOLD;
  const visible = !isLong || expanded
    ? description
    : description.slice(0, TRUNCATE_THRESHOLD).trimEnd() + "…";

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-base leading-7 text-neutral-700">
        {visible}
      </p>
      {isLong && (
        <Button
          variant="link"
          className="h-auto p-0 text-neutral-900 underline-offset-4"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </Button>
      )}
    </div>
  );
}

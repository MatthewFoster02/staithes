"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface PricingRuleRowData {
  id: string;
  name: string;
  type: string;
  priority: number;
  isActive: boolean;
  summary: string; // human-readable "what does this rule do"
}

export function PricingRuleRow({ rule }: { rule: PricingRuleRowData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      await fetch(`/api/admin/pricing-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/pricing-rules/${rule.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-neutral-900">{rule.name}</p>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            {rule.type.replace(/_/g, " ")}
          </span>
          {!rule.isActive && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-600">{rule.summary}</p>
        <p className="mt-0.5 text-xs text-neutral-500">Priority: {rule.priority}</p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/admin/pricing/${rule.id}`}
          className="inline-flex h-8 items-center rounded-md border border-neutral-300 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Edit
        </Link>
        <Button variant="outline" size="sm" onClick={toggleActive} disabled={busy}>
          {rule.isActive ? "Disable" : "Enable"}
        </Button>
        <Button variant="outline" size="sm" onClick={del} disabled={busy}>
          Delete
        </Button>
      </div>
    </li>
  );
}

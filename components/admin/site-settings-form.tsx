"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface SiteSettingsValues {
  siteName: string;
  tagline: string;
  logoUrl: string;
  primaryColour: string;
  accentColour: string;
  contactEmail: string;
  contactPhone: string;
  senderEmail: string;
  senderName: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  analyticsId: string;
  timezone: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
  span = 1,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <label className={`block space-y-1 ${span === 2 ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {help && <span className="block text-xs text-neutral-500">{help}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

// Trim strings and convert "" → null for nullable columns so we don't
// persist empty strings that the UI would re-render as blanks anyway.
function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function SiteSettingsForm({ initial }: { initial: SiteSettingsValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function update<K extends keyof SiteSettingsValues>(key: K, value: SiteSettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      siteName: values.siteName,
      tagline: nullIfBlank(values.tagline),
      logoUrl: nullIfBlank(values.logoUrl),
      primaryColour: nullIfBlank(values.primaryColour),
      accentColour: nullIfBlank(values.accentColour),
      contactEmail: values.contactEmail,
      contactPhone: nullIfBlank(values.contactPhone),
      senderEmail: nullIfBlank(values.senderEmail),
      senderName: nullIfBlank(values.senderName),
      seoTitle: nullIfBlank(values.seoTitle),
      seoDescription: nullIfBlank(values.seoDescription),
      ogImageUrl: nullIfBlank(values.ogImageUrl),
      analyticsId: nullIfBlank(values.analyticsId),
      timezone: values.timezone,
    };

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        setSubmitting(false);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Brand">
        <Field label="Site name">
          <input
            type="text"
            value={values.siteName}
            onChange={(e) => update("siteName", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Tagline" help="Optional short strapline.">
          <input
            type="text"
            value={values.tagline}
            onChange={(e) => update("tagline", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Logo URL" help="Absolute URL to a PNG or SVG." span={2}>
          <input
            type="url"
            value={values.logoUrl}
            onChange={(e) => update("logoUrl", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Primary colour" help="Hex, e.g. #0a0a0a">
          <input
            type="text"
            value={values.primaryColour}
            onChange={(e) => update("primaryColour", e.target.value)}
            placeholder="#0a0a0a"
            className={inputClass}
          />
        </Field>
        <Field label="Accent colour" help="Hex, e.g. #10b981">
          <input
            type="text"
            value={values.accentColour}
            onChange={(e) => update("accentColour", e.target.value)}
            placeholder="#10b981"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Contact email" help="Shown to guests who need to reach you.">
          <input
            type="email"
            value={values.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Contact phone">
          <input
            type="tel"
            value={values.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Transactional email">
        <Field label="Sender email" help="The `from` address for automated emails.">
          <input
            type="email"
            value={values.senderEmail}
            onChange={(e) => update("senderEmail", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Sender name" help="The `from` display name, e.g. “The Staithes team”.">
          <input
            type="text"
            value={values.senderName}
            onChange={(e) => update("senderName", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="SEO & social">
        <Field label="Default page title" help="Overrides the property name on the home page." span={2}>
          <input
            type="text"
            value={values.seoTitle}
            onChange={(e) => update("seoTitle", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Meta description" help="1–2 sentences used for search snippets." span={2}>
          <textarea
            value={values.seoDescription}
            onChange={(e) => update("seoDescription", e.target.value)}
            rows={3}
            maxLength={500}
            className={inputClass}
          />
        </Field>
        <Field label="OG image URL" help="Used for link previews. 1200×630 recommended." span={2}>
          <input
            type="url"
            value={values.ogImageUrl}
            onChange={(e) => update("ogImageUrl", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="Plausible domain"
          help="The domain set up on plausible.io (e.g. staithes.vercel.app). Leave blank to disable analytics. No cookie banner needed."
        >
          <input
            type="text"
            value={values.analyticsId}
            onChange={(e) => update("analyticsId", e.target.value)}
            placeholder="staithes.vercel.app"
            className={inputClass}
          />
        </Field>
        <Field label="Timezone" help="IANA tz, e.g. Europe/London.">
          <input
            type="text"
            value={values.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        {savedAt && (
          <span className="text-xs text-emerald-700">
            Saved {savedAt.toLocaleTimeString("en-GB")}
          </span>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

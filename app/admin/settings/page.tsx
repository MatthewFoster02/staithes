import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  SiteSettingsForm,
  type SiteSettingsValues,
} from "@/components/admin/site-settings-form";

export const metadata: Metadata = {
  title: "Admin · Settings",
};

export default async function AdminSettingsPage() {
  const config = await prisma.siteConfiguration.findFirst();
  if (!config) notFound();

  const initial: SiteSettingsValues = {
    siteName: config.siteName,
    tagline: config.tagline ?? "",
    logoUrl: config.logoUrl ?? "",
    primaryColour: config.primaryColour ?? "",
    accentColour: config.accentColour ?? "",
    contactEmail: config.contactEmail,
    contactPhone: config.contactPhone ?? "",
    senderEmail: config.senderEmail ?? "",
    senderName: config.senderName ?? "",
    seoTitle: config.seoTitle ?? "",
    seoDescription: config.seoDescription ?? "",
    ogImageUrl: config.ogImageUrl ?? "",
    analyticsId: config.analyticsId ?? "",
    timezone: config.timezone,
  };

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Site settings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Site-wide configuration: branding, contact details, the sender
          identity for automated emails, and the metadata shown in search
          results and link previews.
        </p>
      </header>

      <SiteSettingsForm initial={initial} />
    </article>
  );
}

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { PlausibleScript } from "@/components/analytics/plausible";

// Guest-area chrome. Wraps every page under app/(guest)/ — the
// route group means none of these segments contribute to the URL.
// /admin/* lives outside this group and gets its own dark admin
// chrome via app/admin/layout.tsx.
export default async function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Analytics is loaded on guest pages only. Admin pages are private
  // by definition and don't benefit from public-traffic analytics.
  const config = await prisma.siteConfiguration.findFirst({
    select: { analyticsId: true },
  });
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <PlausibleScript domain={config?.analyticsId ?? null} />
    </div>
  );
}

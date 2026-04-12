import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import { prisma } from "@/lib/db/prisma";
import { AdminHeader } from "@/components/admin/admin-header";

// The proxy already gates /admin/* against signed-in non-hosts and
// signed-out users. The explicit checks below are belt-and-braces:
// they make the layout safe in isolation if the proxy ever drops a
// rule, and they let server components downstream rely on `user`
// existing without re-checking. The proxy keeps the SSR-cached
// experience sharp; this guards the database fetches.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (!isHostEmail(user.email)) redirect("/dashboard");

  const guest = await prisma.guest.findUnique({
    where: { id: user.id },
    select: { firstName: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <AdminHeader firstName={guest?.firstName ?? null} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

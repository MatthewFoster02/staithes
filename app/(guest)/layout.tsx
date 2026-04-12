import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// Guest-area chrome. Wraps every page under app/(guest)/ — the
// route group means none of these segments contribute to the URL.
// /admin/* lives outside this group and gets its own dark admin
// chrome via app/admin/layout.tsx.
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

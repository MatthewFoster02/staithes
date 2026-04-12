import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Welcome to Staithes
      </h1>
      <p className="mt-6 text-lg text-neutral-600">
        A peaceful coastal escape. Booking coming soon.
      </p>
      <div className="mt-8 flex justify-center">
        <Button>Check availability</Button>
      </div>
    </section>
  );
}

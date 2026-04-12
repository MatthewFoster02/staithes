export function Footer() {
  return (
    <footer className="border-t border-neutral-200 mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Staithes</p>
        <p>A short-stay holiday rental</p>
      </div>
    </footer>
  );
}

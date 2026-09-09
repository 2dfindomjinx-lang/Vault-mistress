export default function Loading() {
  return (
    <main
      aria-busy="true"
      role="status"
      className="min-h-screen bg-[#080406] px-6 py-24 text-center text-amber-100"
    >
      <p className="font-serif text-2xl">Opening the court…</p>
    </main>
  );
}

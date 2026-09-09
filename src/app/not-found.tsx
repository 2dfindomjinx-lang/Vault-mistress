import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#080406] px-6 py-24 text-center text-amber-50">
      <p className="court-eyebrow">404</p>
      <h1 className="mt-3 font-serif text-3xl">
        This chamber could not be found
      </h1>
      <Link href="/" className="court-button mt-6 inline-block">
        Return to the court
      </Link>
    </main>
  );
}

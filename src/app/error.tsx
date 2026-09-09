"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#080406] px-6 py-24 text-center text-amber-50">
      <h1 className="font-serif text-3xl">The court could not load</h1>
      <p className="my-4 text-sm text-zinc-300">
        Please try again. You can check your latest activity in your profile.
      </p>
      <button className="court-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

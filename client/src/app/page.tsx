import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-700">Public transport, improved together</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Share your experience at a stop or station.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">The public stop search and feedback journey will be introduced in Phase 4.</p>
      </main>
    </>
  );
}

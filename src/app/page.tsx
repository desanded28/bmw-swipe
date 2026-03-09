import Link from "next/link";
import CarImage from "@/components/CarImage";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="animate-fade-in w-full max-w-sm text-center">
        {/* Hero image */}
        <div className="mx-auto mb-8 h-48 w-full overflow-hidden rounded-2xl border border-white/[0.08]">
          <CarImage modelName="M4" />
        </div>

        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          BMW Swipe
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-gray-400">
          Answer a few quick questions to narrow down from 500+ BMW models to
          your perfect match.
        </p>

        <Link
          href="/swipe"
          className="inline-block w-full rounded-xl bg-[#1a7fd4] py-3.5 text-sm font-medium text-white shadow-md hover:bg-[#1570bd]"
        >
          Start Swiping
        </Link>

        <div className="animate-fade-in-delayed mt-10 flex justify-center gap-6 text-xs text-gray-500">
          <span>Body style</span>
          <span className="text-gray-600">·</span>
          <span>Power</span>
          <span className="text-gray-600">·</span>
          <span>Engine</span>
          <span className="text-gray-600">·</span>
          <span>Fuel</span>
        </div>
      </div>
    </main>
  );
}

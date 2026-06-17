import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2A28] flex flex-col relative">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute filter blur-[40px] opacity-50 w-96 h-96 rounded-full bg-[#E5DFD3] top-[-10%] left-[-10%]"></div>
        <div className="absolute filter blur-[40px] opacity-50 w-[500px] h-[500px] rounded-full bg-[#F3EFE9] top-[40%] right-[-10%]"></div>
      </div>

      <header className="w-full max-w-7xl mx-auto px-6 py-8">
        <Link href="/" className="font-serif font-semibold text-2xl tracking-tight italic text-[#2C2A28]">
          Viltreon.
        </Link>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-6 pb-24 text-center">
        <div className="font-mono text-xs tracking-[0.2em] text-[#D86B5A] mb-5">ERROR 404</div>
        <h1 className="font-serif text-4xl md:text-5xl text-[#2C2A28]">
          This page got filed <span className="italic text-[#8A9A86]">somewhere else.</span>
        </h1>
        <p className="mt-5 text-lg text-[#5A5753] max-w-md">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-10 bg-[#D86B5A] text-white px-8 py-3 rounded-[8px_30px_12px_25px] font-medium hover:-translate-y-0.5 transition-transform inline-block"
        >
          Back to home
        </Link>
      </main>
    </div>
  )
}

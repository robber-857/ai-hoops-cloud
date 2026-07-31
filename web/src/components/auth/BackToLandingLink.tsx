import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { routes } from "@/lib/routes";

export function BackToLandingLink() {
  return (
    <Link
      href={routes.home}
      aria-label="Back to home"
      className="group absolute left-[calc(1rem+env(safe-area-inset-left))] top-[calc(1rem+env(safe-area-inset-top))] z-40 inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3.5 text-sm font-semibold text-white/82 shadow-lg shadow-black/25 backdrop-blur-md transition-colors hover:border-[#ff9f4a]/55 hover:bg-black/80 hover:text-[#ffb66f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9f4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e0e] sm:left-[calc(1.5rem+env(safe-area-inset-left))] sm:top-[calc(1.5rem+env(safe-area-inset-top))] sm:px-4 lg:left-[calc(2rem+env(safe-area-inset-left))] lg:top-[calc(2rem+env(safe-area-inset-top))]"
    >
      <ArrowLeft
        aria-hidden="true"
        className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:-translate-x-0.5"
      />
      <span className="whitespace-nowrap">Back to home</span>
    </Link>
  );
}

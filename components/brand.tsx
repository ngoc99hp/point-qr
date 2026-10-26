import { cn } from "@/lib/utils";

/** Logo mark: gradient tile with a check-in-a-score-bubble glyph. Decorative (hidden from AT). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-grid size-8 place-items-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/30", className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]">
        <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Mark + wordmark, e.g. in headers. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-lg font-extrabold tracking-tight">
        Peer<span className="text-brand-gradient">Score</span>
      </span>
    </span>
  );
}

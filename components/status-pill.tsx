import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "live" | "done" | "idle" | "archived";

const TONE_CLASS: Record<PillTone, string> = {
  live: "bg-coral/15 text-coral-ink ring-coral/30",
  done: "bg-mint/15 text-score-high-ink ring-mint/35",
  idle: "bg-muted text-muted-foreground ring-border",
  archived: "bg-muted text-muted-foreground ring-border",
};

/** Small rounded status chip; `live` gets a pulsing dot (disabled for reduced motion). */
export function StatusPill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {tone === "live" ? (
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-coral" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

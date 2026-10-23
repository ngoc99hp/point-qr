// Lightweight native-element UI for the mobile student page (SPEC §6.1: "tải nhẹ").
// Same look as the shadcn components, without pulling radix-ui into this bundle.
import type { ButtonHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function StudentLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm leading-none font-medium select-none", className)} {...props} />;
}

export function StudentButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground transition-colors",
        "hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export interface Notice {
  kind: "success" | "error";
  text: string;
}

/** Inline, screen-reader-announced feedback instead of a toast library. */
export function NoticeBanner({ notice }: { notice: Notice | null }) {
  return (
    <div aria-live="polite" role="status" className="min-h-0">
      {notice ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            notice.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}

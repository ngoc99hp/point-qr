"use client";

import { cn } from "@/lib/utils";

interface ScoreGridProps {
  options: readonly number[];
  value: number | null;
  onChange: (score: number) => void;
  disabled: boolean;
  describedBy?: string;
}

const formatOption = (score: number) => String(score).replace(".", ",");

/** Quick-pick buttons instead of a slider: precise on small touch screens (SPEC §6.1). */
export function ScoreGrid({ options, value, onChange, disabled, describedBy }: ScoreGridProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Điểm"
      aria-describedby={describedBy}
      className="grid grid-cols-5 gap-2 sm:grid-cols-7"
    >
      {options.map((score) => {
        const isSelected = value === score;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(score)}
            className={cn(
              "h-12 rounded-lg border text-lg font-medium tabular-nums transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "disabled:opacity-50",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background active:bg-muted",
            )}
          >
            {formatOption(score)}
          </button>
        );
      })}
    </div>
  );
}

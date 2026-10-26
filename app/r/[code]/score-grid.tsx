"use client";

import { SCORE_SOFT_CLASS, SCORE_SOLID_CLASS, scoreTier } from "@/lib/score-color";
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
        const tier = scoreTier(score, options[0] ?? 0, options.at(-1) ?? 10);
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(score)}
            className={cn(
              "h-12 rounded-2xl border text-lg font-bold tabular-nums transition-all duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "active:scale-95 disabled:opacity-50",
              isSelected ? cn(SCORE_SOLID_CLASS[tier], "scale-105 shadow-lg") : SCORE_SOFT_CLASS[tier],
            )}
          >
            {formatOption(score)}
          </button>
        );
      })}
    </div>
  );
}

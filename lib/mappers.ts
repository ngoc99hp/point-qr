import type { Prisma } from "@/lib/generated/prisma/client";
import type { ScoreConfig } from "@/lib/score";

/**
 * The only place Decimal values become numbers (SPEC §4). Never pass a Decimal
 * object across the server → client boundary.
 */
export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export interface DecimalScoreConfig {
  minScore: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  scoreStep: Prisma.Decimal;
}

export function toScoreConfig(event: DecimalScoreConfig): ScoreConfig {
  return {
    minScore: decimalToNumber(event.minScore),
    maxScore: decimalToNumber(event.maxScore),
    scoreStep: decimalToNumber(event.scoreStep),
  };
}

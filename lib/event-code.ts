import { randomInt } from "node:crypto";

export const EVENT_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";
export const EVENT_CODE_LENGTH = 6;

const EVENT_CODE_REGEX = new RegExp(`^[A-Z2-9]{${EVENT_CODE_LENGTH}}$`);

/** Returns an integer in [0, max). Injected for deterministic tests. */
export type RandomIndex = (max: number) => number;

/** 6 chars from [A-Z2-9] (SPEC §4), using a CSPRNG by default. */
export function generateEventCode(random: RandomIndex = randomInt): string {
  let code = "";
  for (let i = 0; i < EVENT_CODE_LENGTH; i += 1) {
    code += EVENT_CODE_ALPHABET[random(EVENT_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalizes a code from a URL; returns null when it cannot be a valid code. */
export function parseEventCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return EVENT_CODE_REGEX.test(code) ? code : null;
}

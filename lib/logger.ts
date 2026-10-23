import "server-only";

/**
 * Minimal structured logger. Callers pass identifiers and error codes only —
 * never student codes, names, IPs or secrets (SPEC §10).
 */
type LogContext = Record<string, string | number | boolean | null | undefined>;

export const logger = {
  warn(message: string, context: LogContext = {}): void {
    console.warn(JSON.stringify({ level: "warn", message, ...context }));
  },
  error(message: string, context: LogContext = {}, error?: unknown): void {
    const errorName = error instanceof Error ? error.name : undefined;
    console.error(JSON.stringify({ level: "error", message, errorName, ...context }));
  },
};

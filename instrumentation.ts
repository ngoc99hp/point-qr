export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast at server startup when environment variables are missing or invalid.
    await import("@/lib/env");
  }
}

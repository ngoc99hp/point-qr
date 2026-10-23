// Pure helpers (no server-only import): also used by prisma.config.ts.

const POOLER_SUFFIX = /-pooler(?=\.)/;

/**
 * Neon's direct endpoint is the pooled host without "-pooler"
 * (ep-abc-pooler.region.aws.neon.tech → ep-abc.region.aws.neon.tech).
 * Only the host is rewritten; credentials, path and params are kept as-is.
 */
export function toDirectUrl(connectionString: string): string {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return connectionString;
  }
  if (!POOLER_SUFFIX.test(host)) return connectionString;

  const directHost = host.replace(POOLER_SUFFIX, "");
  const marker = connectionString.includes(`@${host}`) ? "@" : "//";
  return connectionString.replace(`${marker}${host}`, `${marker}${directHost}`);
}

/** DIRECT_URL if set, otherwise derived from DATABASE_URL (SPEC §11). */
export function resolveDirectUrl(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const explicit = env.DIRECT_URL?.trim();
  if (explicit) return explicit;
  const pooled = env.DATABASE_URL?.trim();
  return pooled ? toDirectUrl(pooled) : undefined;
}

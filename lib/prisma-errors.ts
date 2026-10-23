import { Prisma } from "@/lib/generated/prisma/client";

/** True for a foreign-key violation (P2003), e.g. a row pointing at a deleted event. */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/** True for a unique-constraint violation (P2002), optionally on a given index/field. */
export function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!target) return true;
  return JSON.stringify(error.meta ?? {}).includes(target);
}

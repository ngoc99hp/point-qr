import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { planNewGroups, type RosterRow } from "@/lib/roster";

export type ImportMode = "replace" | "append";

export interface ImportSummary {
  created: number;
  updated: number;
  groupsCreated: number;
}

/** Thrown when replace mode is no longer allowed once the transaction holds its locks. */
export class RosterReplaceBlockedError extends Error {}

const IMPORT_TIMEOUT_MS = 20_000;
const UPDATE_CHUNK_SIZE = 500;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Locks every round of the event FOR UPDATE (submitRating holds FOR SHARE on its
 * round), then re-checks the replace preconditions inside the transaction so a
 * rating that arrived after the action's pre-check can never be cascade-deleted.
 */
async function assertReplaceAllowed(tx: Tx, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Round" WHERE "eventId" = ${eventId} FOR UPDATE`;
  const [ratings, openRounds] = await Promise.all([
    tx.rating.count({ where: { round: { eventId } }, take: 1 }),
    tx.round.count({ where: { eventId, status: "OPEN" }, take: 1 }),
  ]);
  if (ratings > 0 || openRounds > 0) throw new RosterReplaceBlockedError();
}

/** One UPDATE … FROM (VALUES …) per chunk instead of one round-trip per student. */
async function updateStudents(
  tx: Tx,
  eventId: string,
  rows: readonly RosterRow[],
  groupIdByName: ReadonlyMap<string, string>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += UPDATE_CHUNK_SIZE) {
    const values = rows
      .slice(start, start + UPDATE_CHUNK_SIZE)
      .map((row) => Prisma.sql`(${row.code}, ${row.fullName}, ${groupIdByName.get(row.groupName) ?? null})`);
    await tx.$executeRaw`
      UPDATE "Student" AS s
      SET "fullName" = v.full_name, "groupId" = v.group_id::text
      FROM (VALUES ${Prisma.join(values)}) AS v(code, full_name, group_id)
      WHERE s."eventId" = ${eventId} AND s.code = v.code`;
  }
}

/**
 * Writes validated roster rows in one transaction (SPEC §6.4).
 * replace: drop all students and groups, then recreate. append: upsert by code.
 * Callers must already have checked ownership and the archived status.
 */
export async function writeRoster(
  eventId: string,
  rows: readonly RosterRow[],
  mode: ImportMode,
): Promise<ImportSummary> {
  return db.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await assertReplaceAllowed(tx, eventId);
        await tx.student.deleteMany({ where: { eventId } });
        await tx.group.deleteMany({ where: { eventId } });
      }

      const existingGroups = await tx.group.findMany({ where: { eventId }, select: { name: true, order: true } });
      const planned = planNewGroups(existingGroups, rows.map((row) => row.groupName));
      if (planned.length > 0) {
        await tx.group.createMany({ data: planned.map((group) => ({ eventId, ...group })) });
      }
      const groups = await tx.group.findMany({ where: { eventId }, select: { id: true, name: true } });
      const groupIdByName = new Map(groups.map((group) => [group.name, group.id]));

      const existingStudents = await tx.student.findMany({
        where: { eventId, code: { in: rows.map((row) => row.code) } },
        select: { code: true },
      });
      const existingCodes = new Set(existingStudents.map((student) => student.code));
      const toCreate = rows.filter((row) => !existingCodes.has(row.code));
      const toUpdate = rows.filter((row) => existingCodes.has(row.code));

      await tx.student.createMany({
        data: toCreate.map((row) => ({
          eventId,
          code: row.code,
          fullName: row.fullName,
          groupId: groupIdByName.get(row.groupName) ?? null,
        })),
      });
      await updateStudents(tx, eventId, toUpdate, groupIdByName);
      return { created: toCreate.length, updated: toUpdate.length, groupsCreated: planned.length };
    },
    { timeout: IMPORT_TIMEOUT_MS },
  );
}

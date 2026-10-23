import "server-only";
import { db } from "@/lib/db";
import { planNewGroups, type RosterRow } from "@/lib/roster";

export type ImportMode = "replace" | "append";

export interface ImportSummary {
  created: number;
  updated: number;
  groupsCreated: number;
}

const IMPORT_TIMEOUT_MS = 20_000;

/**
 * Writes validated roster rows in one transaction (SPEC §6.4).
 * replace: drop all students and groups, then recreate. append: upsert by code.
 * Callers must already have checked ownership and the replace preconditions.
 */
export async function writeRoster(
  eventId: string,
  rows: readonly RosterRow[],
  mode: ImportMode,
): Promise<ImportSummary> {
  return db.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await tx.student.deleteMany({ where: { eventId } });
        await tx.group.deleteMany({ where: { eventId } });
      }

      const existingGroups = await tx.group.findMany({ where: { eventId }, select: { id: true, name: true, order: true } });
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
      for (const row of toUpdate) {
        await tx.student.update({
          where: { eventId_code: { eventId, code: row.code } },
          data: { fullName: row.fullName, groupId: groupIdByName.get(row.groupName) ?? null },
          select: { id: true },
        });
      }
      return { created: toCreate.length, updated: toUpdate.length, groupsCreated: planned.length };
    },
    { timeout: IMPORT_TIMEOUT_MS },
  );
}

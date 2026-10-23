// Load test (SPEC §13): 100 submits in 20 s into one round; target: no 5xx, p95 < 800 ms.
//
// Usage (needs a production build + running server, and .env.local for the DB):
//   pnpm build && pnpm start            # in one terminal (or point BASE_URL elsewhere)
//   pnpm load-test                      # BASE_URL=http://localhost:3000 by default
//
// The submitRating Server Action id is discovered from BASE_URL's own JS chunks, so
// this works against a local build or the Vercel deployment (ids change per build).
// The DB in .env.local must be the one BASE_URL uses. The script seeds a "[TEST] load"
// event (static QR, LOAD_TOTAL raters) and deletes it afterwards.
//   BASE_URL=https://<your-app>.vercel.app pnpm load-test
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TOTAL = Number(process.env.LOAD_TOTAL ?? 100);
const DURATION_MS = Number(process.env.LOAD_DURATION_MS ?? 20_000);
const P95_TARGET_MS = 800;

const { Pool } = await import(pathToFileURL(join(process.cwd(), "node_modules/@neondatabase/serverless/index.mjs")).href);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Finds the submitRating action id in the student page's client chunks. */
async function discoverSubmitActionId(code) {
  const html = await (await fetch(`${BASE_URL}/r/${code}`)).text();
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[^"'\s]+\.js/g) ?? [])];
  for (const chunk of chunks) {
    const js = await (await fetch(`${BASE_URL}${chunk}`)).text();
    const match = js.match(/\("([0-9a-f]{40,})",[^()]*?"submitRating"\)/);
    if (match) return match[1];
  }
  throw new Error("submitRating action id not found on " + BASE_URL);
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seed() {
  const { rows: [lecturer] } = await pool.query(`SELECT id FROM "Lecturer" WHERE email = $1`, [process.env.ADMIN_EMAIL.toLowerCase()]);
  if (!lecturer) throw new Error("Admin lecturer not found — log in once first.");
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  const { rows: [event] } = await pool.query(
    `INSERT INTO "Event" (id, "ownerId", title, code, "rotatingQr", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, '[TEST] load', $2, false, now()) RETURNING id`,
    [lecturer.id, code],
  );
  const { rows: [presenting] } = await pool.query(
    `INSERT INTO "Group" (id, "eventId", name, "order") VALUES (gen_random_uuid()::text, $1, 'Nhóm 1', 1) RETURNING id`, [event.id]);
  const { rows: [raters] } = await pool.query(
    `INSERT INTO "Group" (id, "eventId", name, "order") VALUES (gen_random_uuid()::text, $1, 'Nhóm 2', 2) RETURNING id`, [event.id]);
  await pool.query(
    `INSERT INTO "Student" (id, "eventId", code, "fullName", "groupId")
     SELECT gen_random_uuid()::text, $1, (3300000000 + n)::text, 'Sinh viên ' || n, $2 FROM generate_series(1, $3::int) AS n`,
    [event.id, raters.id, TOTAL],
  );
  await pool.query(`INSERT INTO "Round" (id, "eventId", "groupId", status) VALUES (gen_random_uuid()::text, $1, $2, 'OPEN')`, [event.id, presenting.id]);
  return { eventId: event.id, code };
}

/** One simulated phone: poll the open group (gets a ticket), then submit. */
async function student(index, code) {
  const current = await (await fetch(`${BASE_URL}/api/public/events/${code}/current`)).json();
  const ticket = current.current?.ticket?.value;
  const started = performance.now();
  const response = await fetch(`${BASE_URL}/r/${code}`, {
    method: "POST",
    headers: { "Next-Action": submitActionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE_URL },
    body: JSON.stringify([{
      eventCode: code, ticket, studentCode: String(3300000000 + index + 1), studentName: `Sinh viên ${index + 1}`,
      score: 5 + (index % 11) * 0.5, deviceId: crypto.randomUUID(),
    }]),
  });
  const text = await response.text();
  return { ms: performance.now() - started, status: response.status, ok: /"success":true/.test(text) };
}

const { eventId, code } = await seed();
let submitActionId;
try {
  submitActionId = await discoverSubmitActionId(code);
} catch (error) {
  await pool.query(`DELETE FROM "Event" WHERE id = $1`, [eventId]);
  await pool.end();
  throw error;
}
console.log(`Seeded [TEST] load event ${code}; firing ${TOTAL} submits over ${DURATION_MS / 1000}s at ${BASE_URL}`);
try {
  const tasks = [];
  for (let i = 0; i < TOTAL; i += 1) {
    tasks.push(student(i, code).catch((error) => ({ ms: Number.NaN, status: 0, ok: false, error: String(error) })));
    await sleep(DURATION_MS / TOTAL);
  }
  const results = await Promise.all(tasks);
  const latencies = results.map((r) => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const serverErrors = results.filter((r) => r.status >= 500 || r.status === 0).length;
  const rejected = results.filter((r) => !r.ok).length;
  const { rows: [stored] } = await pool.query(
    `SELECT count(*)::int AS n FROM "Rating" r JOIN "Round" o ON o.id = r."roundId" WHERE o."eventId" = $1`, [eventId]);

  const p95 = percentile(latencies, 95);
  console.log(`submits: ${results.length}, accepted: ${results.length - rejected}, stored ratings: ${stored.n}`);
  console.log(`5xx/network errors: ${serverErrors}`);
  console.log(`latency ms  p50 ${percentile(latencies, 50).toFixed(0)}  p95 ${p95.toFixed(0)}  max ${latencies.at(-1).toFixed(0)}`);
  const pass = serverErrors === 0 && rejected === 0 && stored.n === TOTAL && p95 < P95_TARGET_MS;
  console.log(pass ? "RESULT: PASS" : `RESULT: FAIL (target: no errors, all stored, p95 < ${P95_TARGET_MS} ms)`);
  process.exitCode = pass ? 0 : 1;
} finally {
  await pool.query(`DELETE FROM "Event" WHERE id = $1`, [eventId]);
  await pool.end();
}

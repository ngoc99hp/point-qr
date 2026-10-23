import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";

// SPEC §13 E2E: lecturer logs in, creates an event, imports the roster, opens
// Nhóm 1; three students rate (one self-rating rejected); the projector shows
// n = 2; the round is closed; the summary CSV is exported; the event is deleted.

const RUN = Date.now().toString(36);
const TITLE = `[TEST] Playwright ${RUN}`;
const ROSTER = [
  "MSV\tHọ và tên\tNhóm",
  "2210000001\tĐào Anh Ngọc\tNhóm 1",
  "2210000002\tNguyễn Văn Bình\tNhóm 2",
  "2210000003\tTrần Thị Cúc\tNhóm 2",
].join("\n");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByLabel("Mật khẩu").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** A fresh browser context per student = its own localStorage deviceId. */
async function rateAsStudent(
  browser: Browser,
  url: string,
  student: { code: string; name: string; score: string },
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Đang chấm: Nhóm 1" })).toBeVisible();
  await page.getByLabel("Mã sinh viên").fill(student.code);
  await page.getByLabel("Họ và tên").fill(student.name);
  await page.getByRole("radio", { name: student.score, exact: true }).click();
  await page.getByRole("button", { name: "Gửi điểm" }).click();
  return { page, close: () => context.close() };
}

test.afterAll(async () => {
  // Safety net if the test failed before deleting its event through the UI.
  const { Pool } = (await import(
    pathToFileURL(join(process.cwd(), "node_modules/@neondatabase/serverless/index.mjs")).href
  )) as typeof import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`DELETE FROM "Event" WHERE title = $1`, [TITLE]);
  await pool.end();
});

test("a full class session from setup to CSV export", async ({ page, browser }) => {
  await login(page);

  // Create the event.
  await page.getByLabel("Tạo buổi đánh giá mới").fill(TITLE);
  await page.getByRole("button", { name: "Tạo", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/[^/]+$/);
  // Wait for this event's own page before reading anything (the list page may still be shown).
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  const eventId = page.url().split("/").pop() ?? "";
  const code = (await page.getByTestId("event-code").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  // Import the roster.
  await page.getByLabel(/Dán từ Excel/).fill(ROSTER);
  await expect(page.getByText(/3\s*dòng hợp lệ/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận nhập danh sách" }).click();
  await expect(page.getByText(/Đã nhập: 3 SV mới/)).toBeVisible();

  // Open Nhóm 1 on the projector.
  await page.goto(`/events/${eventId}/live`);
  await page.getByRole("group", { name: "Chọn nhóm" }).getByRole("button", { name: /Nhóm 1/ }).click();
  await page.getByRole("button", { name: "Mở chấm Nhóm 1" }).click();
  await expect(page.getByText("Đang chấm: Nhóm 1")).toBeVisible();

  // Students scan the rotating QR (token fetched the same way the projector does).
  const { token } = (await (await page.request.get(`/api/events/${eventId}/qr-token`)).json()) as { token: string };
  const studentUrl = `/r/${code}?t=${token}`;

  const binh = await rateAsStudent(browser, studentUrl, { code: "2210000002", name: "Nguyễn Văn Bình", score: "8" });
  await expect(binh.page.getByText("Đã gửi điểm.")).toBeVisible();
  const cuc = await rateAsStudent(browser, studentUrl, { code: "2210000003", name: "tran thi cuc", score: "9" });
  await expect(cuc.page.getByText("Đã gửi điểm.")).toBeVisible();
  const ngoc = await rateAsStudent(browser, studentUrl, { code: "2210000001", name: "Đào Anh Ngọc", score: "10" });
  await expect(ngoc.page.getByText("Bạn không thể chấm nhóm của mình.").first()).toBeVisible();
  await Promise.all([binh.close(), cuc.close(), ngoc.close()]);

  // Projector: n = 2, mean 8.5, both raters listed.
  const stats = page.getByRole("region", { name: "Thống kê" });
  await expect(stats.getByText("8,5")).toBeVisible();
  await expect(stats.getByText("Nguyễn Văn Bình")).toBeVisible();
  await expect(stats.getByText("tran thi cuc")).toBeVisible();
  await expect(stats.getByText("2", { exact: true }).first()).toBeVisible();

  // Close the round.
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByText("Chưa mở phiên chấm")).toBeVisible();

  // Export the summary CSV.
  await page.goto(`/events/${eventId}/results`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tải CSV tổng hợp" }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path()) ?? "", "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("1,Nhóm 1,2,8.5,8.5,8.5");

  // Delete the event through the UI (also the test's cleanup).
  await page.goto(`/events/${eventId}`);
  await page.getByRole("button", { name: "Xóa buổi đánh giá" }).click();
  await page.getByLabel(/Gõ .* để xác nhận/).fill(code);
  await page.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
  await expect(page).toHaveURL(/\/events$/);
  expect(await countEventsTitled(TITLE)).toBe(0);
  // Next 16 keeps recently visited pages mounted but hidden (React Activity), so
  // only assert on what is visible: the event list no longer links to it.
  await expect(page.getByRole("link", { name: new RegExp(TITLE.replace(/[[\]]/g, "\\$&")) })).toHaveCount(0);
});

async function countEventsTitled(title: string): Promise<number> {
  const { Pool } = (await import(
    pathToFileURL(join(process.cwd(), "node_modules/@neondatabase/serverless/index.mjs")).href
  )) as typeof import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Event" WHERE title = $1`, [title]);
  await pool.end();
  return rows[0]?.n ?? -1;
}

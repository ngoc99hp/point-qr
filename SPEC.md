# SPEC — PeerScore: Hệ thống sinh viên chấm điểm thuyết trình nhóm

> Tài liệu đặc tả để Claude Code triển khai. File nằm ở thư mục gốc repo với tên **`SPEC.md`** và được tham chiếu từ `CLAUDE.md`.
> Mục có nhãn **[MẶC ĐỊNH]** là giá trị đề xuất, chủ sản phẩm có thể đổi. Mục **§16 Quyết định mở** cần chốt trước khi bắt đầu phase tương ứng. Mục **§17 Quyết định kỹ thuật đã chốt** ghi các điểm đã làm rõ trước P0.

---

## 0. Chỉ dẫn cho Claude Code

1. Làm **tuần tự theo phase (§14)**. Kết thúc mỗi phase thì: chạy `typecheck`, `lint`, `test`, rồi tóm tắt việc đã làm và **dừng lại chờ xác nhận**. Không tự nhảy sang phase sau.
2. Không tự thay đổi quy tắc nghiệp vụ (§5). Nếu thấy mâu thuẫn hoặc thiếu, hỏi lại và đừng tự suy diễn.
3. Tuân thủ convention của skill `nextjs-saas`: App Router, Server Component mặc định, Zod validate mọi input, Server Actions trả `{ success, data?, error? }`, Prisma luôn `select` rõ ràng, không dùng `any`.
4. Ưu tiên tính đúng đắn và đơn giản. Không thêm thư viện ngoài danh sách §3 khi chưa hỏi.
5. Toàn bộ UI dùng tiếng Việt. Code, tên biến và commit message dùng tiếng Anh.
6. Dùng đúng phiên bản đã pin ở §3. Không nâng major version khi chưa hỏi. Khi tài liệu chính thức của phiên bản đang dùng khác với ví dụ trong SPEC, làm theo tài liệu chính thức và báo lại để cập nhật SPEC.
7. Commit theo từng bước logic, message dạng conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Không dùng `any`, không dùng `@ts-ignore`/`@ts-expect-error`.
8. Mức kiểm thử theo phase được quy định ở §14. Từ P1 trở đi, logic nghiệp vụ viết theo TDD (test trước).

---

## 1. Mục tiêu & phạm vi

**Mục tiêu:** Sau khi một nhóm thuyết trình xong, giảng viên (GV) mở phiên chấm cho nhóm đó và chiếu mã QR. Sinh viên (SV) quét mã, nhập MSV, họ tên và điểm (0–10). GV theo dõi kết quả theo thời gian thực trên màn chiếu, sau đó xem tổng hợp và xuất file.

**Trong phạm vi:**
- GV đăng nhập, tạo buổi đánh giá, nhập danh sách lớp kèm phân nhóm
- Mở/đóng phiên chấm cho từng nhóm
- Mã QR (tĩnh hoặc xoay vòng)
- Form chấm tối ưu cho điện thoại
- Dashboard trình chiếu realtime (polling)
- Gắn cờ và loại phiếu nghi vấn
- Trang tổng hợp, xuất CSV

**Ngoài phạm vi (v1):** SV đăng nhập, chấm theo nhiều tiêu chí (rubric), nhận xét bằng văn bản, ứng dụng native, tích hợp LMS.

---

## 2. Vai trò & luồng chính

| Vai trò | Xác thực | Quyền |
|---|---|---|
| Giảng viên / Admin (Lecturer) | **Một tài khoản admin duy nhất** (email + mật khẩu cấu hình qua env, §9.5) | CRUD buổi đánh giá của mình, điều khiển phiên, xem và xuất kết quả |
| Sinh viên (Rater) | Không đăng nhập; cần ticket hợp lệ từ QR | Gửi hoặc sửa phiếu chấm khi phiên đang mở |

**Luồng trong lớp:**
1. GV mở `/events/[id]/live` trên máy chiếu.
2. Nhóm 3 trình bày xong, GV bấm **"Mở chấm Nhóm 3"**. Hệ thống tự đóng phiên đang mở (nếu có) và mở phiên mới. QR hiển thị.
3. SV quét QR và vào `/r/[eventCode]?t=[token]`. Form hiện tiêu đề "Đang chấm: Nhóm 3". SV nhập MSV, Họ tên, Điểm rồi gửi.
4. Dashboard cập nhật mỗi 2 giây: số phiếu, điểm trung bình, trung bình cắt, trung vị, người cho cao nhất và thấp nhất, histogram, phiếu bị gắn cờ.
5. GV bấm **"Đóng"**, hoặc bấm mở nhóm kế tiếp (thao tác này tự đóng nhóm hiện tại).
6. Cuối buổi: `/events/[id]/results` để rà soát phiếu, loại phiếu và xuất CSV.

---

## 3. Kiến trúc & stack

| Layer | Lựa chọn | Phiên bản (pin) | Ghi chú |
|---|---|---|---|
| Runtime | Node.js | `>=22` (`engines`) | Node 22+ có sẵn `WebSocket` toàn cục nên không cần package `ws` |
| Package manager | pnpm | 10+ | |
| Framework | Next.js App Router, TypeScript strict | `next` 16.4.x, `react` 19.x | Theo skill `nextjs-saas`. Next 16 dùng **`proxy.ts`** thay cho `middleware.ts` (xem §6) |
| Ngôn ngữ | TypeScript | **5.9.x** | Không dùng TS 6.1+/7 vì `typescript-eslint` chưa hỗ trợ |
| Lint | ESLint (flat config) + `eslint-config-next` | ESLint 9.x, `eslint-config-next` cùng version với `next` | |
| DB | Neon Postgres | | Region **aws-ap-southeast-1 (Singapore)** |
| ORM | Prisma + `@prisma/adapter-neon` + `@neondatabase/serverless` | `prisma`, `@prisma/client`, `@prisma/adapter-neon` **7.10.x**; `@neondatabase/serverless` 1.x | Driver adapter đã GA nên **không dùng `previewFeatures`**. Dùng `PrismaNeon` (WebSocket Pool) để hỗ trợ interactive transaction, **không dùng** `PrismaNeonHttp`. Cấu hình chi tiết ở §4.1 |
| Auth | Auth.js v5 (`next-auth`), **Credentials provider** (1 tài khoản admin), JWT session | **`5.0.0-beta.32`** (pin chính xác, v5 chưa có bản stable) | Tài khoản qua env `ADMIN_EMAIL` + `ADMIN_PASSWORD`. Không dùng OAuth, không dùng `@auth/prisma-adapter` |
| UI | Tailwind v4 + shadcn/ui | `tailwindcss` 4.x, CLI `shadcn` 4.x | Kèm `next-themes` (component Sonner của shadcn cần, và dùng cho dark mode ở P4) |
| Client state | TanStack Query v5 | 5.x | Chỉ dùng cho polling dashboard và trạng thái phiên phía SV (từ P1) |
| Validation | Zod + react-hook-form | `zod` 4.x, `react-hook-form` 7.x, `@hookform/resolvers` 5.x+ | |
| QR | `qrcode` (render client-side ra canvas/SVG) | 1.5.x | Từ P1 |
| Hosting | Vercel | | Function region **`sin1`** (cùng region với Neon) |
| Test | Vitest (unit), Playwright (E2E) | `vitest` 5.x | Playwright từ P4 |

**Dependency phụ được phép** (đi kèm stack ở trên, không cần hỏi lại): các package do `shadcn` CLI tự thêm (`radix-ui`/`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`), `@tailwindcss/postcss`, `@types/*`, `typescript-eslint`, `server-only` (package nhỏ do Next khuyến nghị, chặn import module server vào client). Ngoài danh sách này thì phải hỏi trước khi thêm, cụ thể là **không thêm `dotenv`, `ws`, `@auth/prisma-adapter`**.

**Vì sao polling thay vì WebSocket/SSE:** Vercel Functions không giữ kết nối lâu. Polling 2 giây từ một màn chiếu duy nhất tạo tải không đáng kể và đơn giản hơn nhiều. Chỉ cân nhắc dịch vụ realtime (Pusher, Ably) nếu có yêu cầu nhiều màn hình đồng thời.

**Neon cold start:** Gói free tự suspend compute sau một thời gian không hoạt động, nên request đầu tiên có thể chậm khoảng 0,5–1 giây. Cách xử lý: GV mở trang live trước giờ học để làm "nóng" DB. Không cần xử lý thêm trong code.

---

## 4. Mô hình dữ liệu (Prisma)

### 4.1 Cấu hình Prisma 7 + Neon

Prisma 7 đã bỏ `url`/`directUrl` trong `schema.prisma` và `prisma-client-js`. Cấu hình bắt buộc:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"   // bắt buộc; thư mục này nằm trong .gitignore
}

datasource db {
  provider = "postgresql"                // không khai báo url/directUrl ở đây
}
```

```ts
// prisma.config.ts — CLI (migrate, deploy, studio) dùng URL DIRECT, không qua pooler
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file); // Prisma 7 không tự đọc .env; dùng API có sẵn của Node, không cần dotenv
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Dùng process.env thay vì env(): env() throw khi thiếu biến, làm hỏng `prisma generate`
  // (postinstall, build Vercel) ở môi trường không có DB URL. Lệnh migrate vẫn báo lỗi nếu thiếu.
  // DIRECT_URL là tùy chọn: nếu không có thì suy ra từ DATABASE_URL bằng cách bỏ "-pooler" khỏi host.
  datasource: { url: resolveDirectUrl(process.env) },
});
```

```ts
// lib/db.ts — runtime dùng URL POOLED qua driver adapter, singleton
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- `package.json` có `"type": "module"` (Prisma 7 là ESM) và script `postinstall: prisma generate` (Prisma 7 không tự generate sau `migrate dev`).
- Nếu bản Prisma đang dùng có tên export hoặc đường dẫn import khác với ví dụ trên thì làm theo tài liệu chính thức (§0.6).

### 4.2 Schema nghiệp vụ (đầy đủ, áp dụng từ P1)

P0 chỉ tạo model `Lecturer`, **chưa có** field `events` (vì `Event` chưa tồn tại). Relation này được bổ sung ở P1.

```prisma
model Lecturer {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  events    Event[]
}

enum EventStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model Event {
  id                 String      @id @default(cuid())
  ownerId            String
  owner              Lecturer    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  title              String
  code               String      @unique          // 6 ký tự [A-Z2-9], dùng trong URL QR
  status             EventStatus @default(ACTIVE)

  // Cấu hình chấm
  minScore           Decimal     @default(0)   @db.Decimal(3, 1)
  maxScore           Decimal     @default(10)  @db.Decimal(3, 1)
  scoreStep          Decimal     @default(0.5) @db.Decimal(2, 1)  // [MẶC ĐỊNH] 0.5
  trimRatio          Decimal     @default(0.1) @db.Decimal(3, 2)  // [MẶC ĐỊNH] cắt 10% mỗi đầu
  rankingMetric      RankingMetric @default(TRIMMED_MEAN)
  studentCodePattern String      @default("^[A-Z0-9]{5,15}$")    // áp dụng sau normalize
  strictRoster       Boolean     @default(true)   // MSV không có trong roster → từ chối
  rotatingQr         Boolean     @default(true)   // QR xoay vòng, buộc quét tại lớp
  hideRaterNamesOnProjector Boolean @default(false)

  createdAt          DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime    @updatedAt      @db.Timestamptz(3)

  groups             Group[]
  students           Student[]
  rounds             Round[]

  @@index([ownerId])
}

enum RankingMetric {
  MEAN
  TRIMMED_MEAN
  MEDIAN
}

model Group {
  id        String    @id @default(cuid())
  eventId   String
  event     Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name      String                // "Nhóm 1"
  order     Int
  students  Student[]
  round     Round?

  @@unique([eventId, name])
  @@unique([eventId, order])
}

model Student {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  code      String                // MSV đã normalize (trim + uppercase)
  fullName  String
  groupId   String?
  group     Group?   @relation(fields: [groupId], references: [id], onDelete: SetNull)
  ratings   Rating[]

  @@unique([eventId, code])
}

enum RoundStatus {
  OPEN
  CLOSED
}

// Mỗi nhóm có đúng 1 round; mở lại = chuyển status về OPEN
model Round {
  id         String      @id @default(cuid())
  eventId    String
  event      Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  groupId    String      @unique
  group      Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  status     RoundStatus @default(OPEN)
  openedAt   DateTime    @default(now()) @db.Timestamptz(3)
  closedAt   DateTime?   @db.Timestamptz(3)
  ratings    Rating[]

  @@index([eventId, status])
}

enum RatingFlag {
  UNKNOWN_STUDENT        // MSV không có trong roster (chỉ khi strictRoster=false)
  NAME_MISMATCH          // tên nhập khác tên trong roster
  DEVICE_MULTI_STUDENT   // cùng deviceId đã gửi cho MSV khác trong round này
}

model Rating {
  id          String       @id @default(cuid())
  roundId     String
  round       Round        @relation(fields: [roundId], references: [id], onDelete: Cascade)
  studentCode String                     // normalize
  studentName String                     // tên SV tự nhập
  studentId   String?                    // match roster nếu có
  student     Student?     @relation(fields: [studentId], references: [id], onDelete: SetNull)
  score       Decimal      @db.Decimal(3, 1)
  flags       RatingFlag[] @default([])
  excluded    Boolean      @default(false)   // bị loại khỏi thống kê
  excludedBy  String?                        // "AUTO" | lecturerId
  deviceId    String                         // UUID client (localStorage)
  ipHash      String                         // sha256(ip + TICKET_SECRET), không lưu IP thô
  userAgent   String?
  editCount   Int          @default(0)
  createdAt   DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt      @db.Timestamptz(3)

  @@unique([roundId, studentCode])           // 1 phiếu / SV / nhóm → upsert
  @@index([roundId, excluded])
  @@index([roundId, deviceId])
}
```

**Migration SQL bổ sung** (tạo bằng `prisma migrate dev --create-only` rồi sửa tay):

```sql
-- Tối đa 1 round OPEN cho mỗi event (Prisma không hỗ trợ partial index trong schema)
CREATE UNIQUE INDEX "Round_one_open_per_event"
  ON "Round" ("eventId") WHERE status = 'OPEN';

ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_score_range" CHECK (score >= 0 AND score <= 10);
```

**Quy ước Decimal:** Chuyển `Decimal` sang `number` tại đúng một mapper (`lib/mappers.ts`). Không truyền object `Decimal` qua ranh giới server→client.

---

## 5. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | Mỗi event có tối đa **1 round OPEN** tại một thời điểm. Mở round mới sẽ tự đóng round đang mở, thực hiện trong một transaction. |
| BR-02 | Mỗi nhóm có đúng 1 round. Mở lại round đã đóng: `status=OPEN`, `closedAt=null`, **giữ nguyên các phiếu cũ**. |
| BR-03 | Chỉ nhận phiếu khi round `OPEN`. Phiếu gửi tới round đã đóng thì từ chối với thông báo "Phiên chấm đã đóng". |
| BR-04 | Normalize MSV: `trim()` rồi `toUpperCase()`, sau đó kiểm tra với `studentCodePattern`. |
| BR-05 | Điểm phải thuộc `[minScore, maxScore]` và là bội số của `scoreStep`. Kiểm tra bằng số nguyên (`score*10 % step*10 === 0`), không so sánh float trực tiếp. |
| BR-06 | **1 phiếu / MSV / round.** Gửi lại khi round còn mở thì upsert (ghi đè điểm, `editCount++`). UI báo "Đã cập nhật điểm". |
| BR-07 | **Chặn tự chấm:** nếu MSV thuộc chính nhóm đang được chấm (theo roster), từ chối với thông báo "Bạn không thể chấm nhóm của mình". |
| BR-08 | `strictRoster=true`: MSV không có trong roster thì từ chối. `strictRoster=false`: nhận phiếu, gắn cờ `UNKNOWN_STUDENT`, không tự loại. |
| BR-09 | So tên: normalize cả hai phía (bỏ dấu bằng NFD, **thay `đ/Đ` thành `d`**, lowercase, gộp khoảng trắng). Khác nhau thì gắn cờ `NAME_MISMATCH`, không tự loại. |
| BR-10 | Nếu `deviceId` đã gửi phiếu cho MSV **khác** trong cùng round: phiếu mới gắn cờ `DEVICE_MULTI_STUDENT` và **tự loại** (`excluded=true, excludedBy="AUTO"`). **[MẶC ĐỊNH]** |
| BR-11 | GV có thể loại hoặc khôi phục bất kỳ phiếu nào ở trang results. Thống kê chỉ tính phiếu `excluded=false`. |
| BR-12 | `rotatingQr=true`: SV phải quét QR **cho từng nhóm**. Ticket gắn với `roundId` (xem §9). `rotatingQr=false`: QR tĩnh, trang SV tự chuyển sang nhóm đang mở. |
| BR-13 | Xếp hạng nhóm theo `rankingMetric`. Hòa điểm thì xét tiếp `mean`, rồi số phiếu. |
| BR-14 | Thời gian lưu UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`. |

---

## 6. Màn hình & routes

Không có thư mục `src/`; alias `@/*` trỏ tới thư mục gốc repo.

```
app/
  api/auth/[...nextauth]/route.ts        ← handler Auth.js (P0)
  (auth)/login/page.tsx
  (dashboard)/
    layout.tsx
    events/page.tsx                      ← danh sách + tạo event
    events/[id]/page.tsx                 ← setup: cấu hình, nhóm, roster
    events/[id]/live/page.tsx            ← màn chiếu (QR + stats + điều khiển)
    events/[id]/results/page.tsx         ← tổng hợp, rà soát, export
  r/[code]/page.tsx                      ← trang chấm của SV (public)
  api/
    events/[id]/live/route.ts            ← GET: round hiện tại + stats (auth, polling)
    events/[id]/qr-token/route.ts        ← GET: token QR hiện tại (auth)
    events/[id]/export/route.ts          ← GET ?type=summary|raw (auth) → CSV
    public/events/[code]/current/route.ts← GET: nhóm đang mở (public, cho chế độ QR tĩnh)
  actions/
    events.ts      ← createEvent, updateEventSettings, setEventArchived (lưu trữ / khôi phục)
    roster.ts      ← addGroup, renameGroup, moveGroup, deleteGroup (P1); importRoster (P2)
    rounds.ts      ← openRound(groupId), closeRound(roundId)
    ratings.ts     ← submitRating (public), setRatingExcluded (auth)
lib/
  env.ts            ← Zod validate env (§11), có unit test
  db.ts, auth.ts, utils.ts, mappers.ts
  generated/prisma/ ← Prisma Client do `prisma generate` sinh ra (gitignored)
  stats.ts          ← hàm thuần, có unit test
  normalize.ts      ← normalizeCode, normalizeName (unit test)
  ticket.ts         ← sign/verify QR token & ticket (unit test)
  validations/*.ts
  data/             ← truy vấn server-only: ownership (lọc ownerId), live snapshot, public
  action-result.ts  ← kiểu { success, data } | { success, error: { code, message, field? } }
  score.ts, event-code.ts, format.ts (BR-14), student-storage.ts (localStorage phía SV)
types/next-auth.d.ts← mở rộng type Session/JWT với lecturerId
prisma/schema.prisma, prisma/migrations/
prisma.config.ts
auth.config.ts      ← cấu hình Auth.js nhẹ (không import Prisma), dùng chung cho proxy
instrumentation.ts  ← import lib/env để fail sớm khi server khởi động
proxy.ts            ← (Next 16, thay middleware.ts) bảo vệ route
vercel.json
```

**Quy tắc `proxy.ts`:** route group `(dashboard)` không xuất hiện trong URL, nên proxy **mặc định yêu cầu đăng nhập cho mọi route**, trừ các route public sau:
- `/login`
- `/r/*`
- `/api/public/*`
- `/api/auth/*`
- static assets (`/_next/*`, `favicon.ico`, file tĩnh trong `public/`)

Chưa đăng nhập: trang thì redirect về `/login?callbackUrl=…`, còn `/api/*` thì trả `401`. Đã đăng nhập mà vào `/login` thì redirect về `/events`. `/` redirect về `/events`.

### 6.1 `/r/[code]`: form SV (mobile-first)
- Header: tên event và **"Đang chấm: Nhóm X"** (chữ lớn).
- Trường nhập: MSV (`inputMode="text"`, `autoCapitalize="characters"`), Họ tên, Điểm.
- Ô nhập điểm: **dãy nút chọn nhanh** theo `scoreStep` (0, 0.5, …, 10) dạng lưới, kèm hiển thị giá trị đã chọn. Không dùng slider vì khó chọn chính xác trên điện thoại.
- Lưu MSV và Họ tên vào `localStorage` để tự điền cho các nhóm sau.
- Sinh `deviceId` (UUID v4) lưu ở `localStorage` lần đầu.
- Các trạng thái hiển thị: chưa có phiên mở, phiên đã đóng, ticket hết hạn ("Vui lòng quét lại mã QR trên màn chiếu"), gửi thành công, cập nhật thành công, lỗi validate từng trường.
- Nút gửi bị disable khi đang submit (chống double-submit). Yêu cầu: hiển thị tốt trên màn hình 360px và tải nhẹ (không nhúng thư viện nặng).

### 6.2 `/events/[id]/live`: màn chiếu
- Bố cục 2 cột (≥1024px): **trái** là QR lớn (≥ 40vh) kèm URL rút gọn bên dưới; **phải** là stats.
- Thanh điều khiển: danh sách nhóm dạng nút (trạng thái: chưa chấm / đang mở / đã đóng kèm số phiếu), nút **Mở chấm**, **Đóng**, **Nhóm tiếp →**.
- Khối stats: số phiếu (font rất lớn), Trung bình, Trung bình cắt, Trung vị, Độ lệch chuẩn, **Cao nhất** (điểm và tên người chấm; nếu đồng điểm thì hiện "và N người khác"), **Thấp nhất** (tương tự), histogram 11 cột (0–10), số phiếu bị cờ hoặc bị loại.
- `hideRaterNamesOnProjector=true` thì ẩn tên, chỉ hiện điểm.
- Polling `GET /api/events/[id]/live` mỗi **2 giây** khi có round OPEN, **10 giây** khi không có. Dừng polling khi tab ẩn (`refetchIntervalInBackground: false`).
- QR xoay vòng: fetch `qr-token` mỗi 20 giây, render lại QR client-side.
- Có nút toàn màn hình. Hỗ trợ dark mode (máy chiếu thường dễ đọc hơn với nền tối).

### 6.3 `/events/[id]/results`
- Bảng tổng hợp các nhóm: Hạng, Nhóm, Số phiếu, TB, TB cắt, Trung vị, Min, Max, Số phiếu bị loại.
- Click vào một nhóm để xem bảng phiếu chi tiết: MSV, Tên nhập, Tên roster, Điểm, Cờ (badge), Thời gian, Số lần sửa, công tắc **Loại/Khôi phục**.
- Bộ lọc: chỉ phiếu có cờ, chỉ phiếu bị loại.
- Export: **Summary CSV** và **Raw CSV**, encoding **UTF-8 có BOM** để Excel hiển thị đúng tiếng Việt.

### 6.4 `/events/[id]`: setup
- Form cấu hình event (các trường ở §4).
- Import roster: **dán trực tiếp từ Excel (TSV)** hoặc upload CSV. Cột bắt buộc là `MSV`, `Họ tên`, `Nhóm`. Hiển thị preview kèm lỗi theo từng dòng (MSV sai định dạng, MSV trùng) trước khi xác nhận. Nhóm chưa tồn tại thì tự tạo, `order` lấy theo số trong tên nhóm nếu có.
- Chế độ import: **thay thế toàn bộ** hoặc **bổ sung**. Không cho thay thế khi event đã có phiếu (hiện cảnh báo).
- Quản lý nhóm thủ công: thêm, đổi tên, sắp xếp lại.

---

## 7. Hợp đồng API / Server Actions

```ts
// actions/ratings.ts — PUBLIC
submitRating(input: {
  eventCode: string;
  ticket: string;          // từ §9
  studentCode: string;
  studentName: string;     // 2..100 ký tự
  score: number;
  deviceId: string;        // uuid
}): Promise<
  | { success: true; data: { status: "created" | "updated"; groupName: string } }
  | { success: false; error: { code: SubmitErrorCode; message: string; field?: string } }
>;

type SubmitErrorCode =
  | "VALIDATION" | "TICKET_INVALID" | "TICKET_EXPIRED" | "ROUND_CLOSED"
  | "NOT_IN_ROSTER" | "SELF_RATING" | "RATE_LIMITED";
```

Thứ tự xử lý `submitRating` (đặt **trong một transaction** từ bước 4):
1. Zod parse, normalize MSV (BR-04), kiểm tra điểm (BR-05).
2. Verify ticket và lấy `roundId` (§9).
3. Rate limit theo `deviceId` (§9.3).
4. Load round (`select` status, groupId, event config) và kiểm tra OPEN (BR-03).
5. Tra roster theo `(eventId, code)` và áp dụng BR-07, BR-08, BR-09.
6. Kiểm tra device-multi (BR-10).
7. `upsert` theo `(roundId, studentCode)`. Khi update thì `editCount: { increment: 1 }`, đồng thời tính lại flags.

```ts
// GET /api/events/[id]/live — AUTH, Cache-Control: no-store
type LiveResponse = {
  event: { id: string; title: string; code: string; rotatingQr: boolean };
  groups: { id: string; name: string; order: number; roundStatus: "NONE" | "OPEN" | "CLOSED"; validCount: number }[];
  current: null | { roundId: string; groupId: string; groupName: string; openedAt: string; stats: GroupStats };
};
```

---

## 8. Thống kê (`lib/stats.ts`: hàm thuần)

Số phiếu mỗi nhóm nhỏ (≤ 200), nên **tính trong TypeScript** thay vì SQL phức tạp: dễ test và dễ đổi công thức. Query chỉ lấy các field cần dùng của phiếu `excluded=false`.

```ts
type RatingInput = { score: number; studentCode: string; studentName: string; createdAt: Date };

type GroupStats = {
  n: number;
  mean: number | null;
  trimmedMean: number | null;
  median: number | null;
  stdDev: number | null;          // sample std (n-1); null nếu n<2
  highest: { score: number; raters: { code: string; name: string }[] } | null;
  lowest:  { score: number; raters: { code: string; name: string }[] } | null;
  histogram: number[];            // length 11, bucket = floor(score), score=10 → bucket 10
  flaggedCount: number;
  excludedCount: number;
};

export function computeStats(ratings: RatingInput[], trimRatio: number): GroupStats;
```

- **Trimmed mean:** `k = floor(n * trimRatio)`. Nếu `n - 2k >= 1` thì bỏ `k` giá trị thấp nhất và `k` giá trị cao nhất; ngược lại dùng `mean`.
- `highest` và `lowest` trả **tất cả** người đồng điểm, sắp theo `createdAt`.
- Làm tròn **chỉ khi hiển thị** (2 chữ số thập phân), không làm tròn trong tính toán.
- Unit test bắt buộc cho: n=0, n=1, toàn đồng điểm, điểm 10 rơi vào bucket 10, trimmed mean với n=9 và n=10, nhiều người đồng max/min.

---

## 9. Chống gian lận & bảo mật

### 9.1 QR token xoay vòng (`rotatingQr=true`)
- `token = base64url(roundId + "." + window + "." + HMAC_SHA256(TICKET_SECRET, roundId + "." + window).slice(0,16))`, với `window = floor(now / 30s)`.
- Token hợp lệ nếu `window ∈ {current, current-1}` (khoảng 30–60 giây). Muốn dùng được thì phải ở trong phòng nhìn màn chiếu, chụp mã gửi bạn ở ngoài sẽ nhanh hết hạn.
- Khi trang `/r/[code]?t=…` render (Server Component), server verify token. Nếu hợp lệ thì phát **ticket** để nhúng vào form (hidden field).

### 9.2 Ticket
- `ticket = sign({ roundId, iat, exp: iat + 15 phút })` bằng HMAC (`TICKET_SECRET`). Không cần cookie.
- SV có 15 phút để nhập. Ticket chỉ dùng được cho đúng `roundId` đó, nên sang nhóm khác phải quét lại.
- `rotatingQr=false`: URL QR là `/r/[code]`, không cần token. Server phát ticket cho round OPEN hiện tại. Trang SV polling `public/.../current` mỗi 3 giây để tự chuyển nhóm.

### 9.3 Rate limit
- **Không rate limit theo IP:** cả lớp dùng chung Wi-Fi trường (cùng IP NAT), chặn theo IP sẽ chặn nhầm cả lớp.
- Giới hạn theo `deviceId`: tối đa **10 lần submit / phút / event**, đếm bằng query trên `Rating.updatedAt` hoặc bảng nhẹ. Không thêm Redis ở v1.

### 9.4 Giới hạn đã biết (ghi rõ để không kỳ vọng sai)
Không có đăng nhập SV thì **không thể ngăn hoàn toàn việc chấm hộ** bằng MSV của người khác. QR xoay vòng (buộc có mặt), cờ thiết bị và việc GV rà soát là các lớp giảm thiểu. `deviceId` nằm ở localStorage nên có thể bị xóa; nó chỉ là tín hiệu, không phải bằng chứng.

### 9.5 Bảo mật khác
- Mọi query phía GV phải lọc theo `ownerId = session.lecturerId`. Truy cập event của người khác trả 404, không trả 403.
- Endpoint public không bao giờ trả roster hay danh sách phiếu. Chỉ trả tên event và tên nhóm đang mở.
- Lưu `ipHash`, không lưu IP thô.
- Server Actions đã có kiểm tra Origin của Next. Không tắt cơ chế này.
- **Đăng nhập admin** (Auth.js Credentials provider, thay cho Google OAuth từ sau P0):
  - Chỉ có **một tài khoản** được cấu hình qua env `ADMIN_EMAIL` và `ADMIN_PASSWORD`. Không có trang đăng ký, không có đổi mật khẩu trong app; muốn đổi thì sửa env rồi deploy lại.
  - Form `/login` gồm Email và Mật khẩu, được validate bằng Zod. Email so khớp sau khi `trim()` + `toLowerCase()`. Mật khẩu so khớp bằng `crypto.timingSafeEqual` trên digest SHA-256 của cả hai phía (không phụ thuộc độ dài, chống timing attack).
  - Sai thông tin thì hiện "Email hoặc mật khẩu không đúng." **Không** tiết lộ trường nào sai.
  - `ADMIN_PASSWORD` dài **≥ 16 ký tự**. Đây là biện pháp chống brute force **duy nhất** ở P1, vì form đăng nhập chưa có rate limit (không dùng Redis). Nên dùng mật khẩu ngẫu nhiên (`openssl rand -base64 24`). Rate limit đăng nhập được đưa vào **quyết định mở D10**.
  - Lúc đăng nhập thành công (trong `authorize`), upsert `Lecturer` theo `ADMIN_EMAIL` (name mặc định "Admin") rồi gán `token.lecturerId = lecturer.id`. Mọi event thuộc `Lecturer` này.
  - Callback `session` đưa `session.user.lecturerId`. Type được mở rộng trong `types/next-auth.d.ts` (module `next-auth` và `next-auth/jwt`), không cast `any`.
  - JWT session có `maxAge` 12 giờ. `requireLecturer()` (lib/auth.ts) **kiểm tra lại email session === `ADMIN_EMAIL` mỗi lần truy cập**, nên đổi `ADMIN_EMAIL` sẽ thu hồi session cũ ngay.
  - Proxy chỉ là kiểm tra lạc quan. **Mọi page, Server Action và route handler phía GV đều phải gọi `requireLecturer()`**; không được dựa vào proxy hay layout.
  - Header bảo mật cơ bản được đặt trong `next.config.ts`: chống nhúng iframe, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. CSP đầy đủ để sau.

---

## 10. Hiệu năng & vận hành

- Tải dự kiến: khoảng 30–80 SV gửi trong 30–60 giây mỗi nhóm. Đây là tải rất nhẹ, điều quan trọng là **dùng pooled connection** và driver adapter Neon.
- Prisma client singleton (`lib/db.ts`). Không mở client mới cho mỗi request.
- Endpoint live dùng một query cho round hiện tại và một query `groupBy` để đếm phiếu theo nhóm. Không để N+1.
- Index đã khai báo ở §4. Kiểm tra bằng `EXPLAIN` cho query live.
- `vercel.json`: `"regions": ["sin1"]`.
- **Migration production chạy thủ công** (`pnpm db:deploy` từ máy GV/CI với `DIRECT_URL` production). **Không** gắn `prisma migrate deploy` vào build Vercel, để tránh preview deploy migrate nhầm DB. Build Vercel chỉ cần `prisma generate`, đã có qua `postinstall`.
- Scripts trong `package.json`: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `lint`, `test` (`vitest run`), `db:migrate` (`prisma migrate dev`), `db:deploy` (`prisma migrate deploy`), `postinstall` (`prisma generate`).
- Log lỗi submit (mã lỗi, eventId, roundId), **không log** MSV hay tên ra console production.

---

## 11. Biến môi trường

```
DATABASE_URL=postgresql://...-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require
# DIRECT_URL=postgresql://....ap-southeast-1.aws.neon.tech/db?sslmode=require   # tùy chọn
AUTH_SECRET=
ADMIN_EMAIL=admin@hpu.edu.vn
ADMIN_PASSWORD=           # ≥ 16 ký tự
TICKET_SECRET=            # ≥ 32 bytes random
NEXT_PUBLIC_APP_URL=https://<domain>
```

Kèm file `.env.example`. Validate env lúc khởi động bằng Zod (`lib/env.ts`) để ứng dụng fail sớm nếu thiếu biến.

**Quy ước `lib/env.ts`:**
- Export hàm thuần `parseEnv(raw: Record<string, string | undefined>)` để unit test được, và hằng `env` đã parse từ `process.env`. Thiếu biến hoặc sai biến thì throw lỗi liệt kê **tên** biến sai, không in giá trị.
- Quy tắc: `DATABASE_URL` và `NEXT_PUBLIC_APP_URL` phải là URL hợp lệ. `AUTH_SECRET` và `TICKET_SECRET` dài ≥ 32 ký tự. `ADMIN_EMAIL` là email hợp lệ (được trim + lowercase). `ADMIN_PASSWORD` dài ≥ 16 ký tự.
- **`DIRECT_URL` là tùy chọn.** Console Neon chỉ hiện một connection string, có nút bật/tắt *Connection pooling*. URL direct chính là URL pooled bỏ `-pooler` khỏi host (ví dụ `ep-abc-pooler.ap-southeast-1…` → `ep-abc.ap-southeast-1…`). Nếu không khai báo `DIRECT_URL`, `prisma.config.ts` tự suy ra theo cách này (hàm thuần `resolveDirectUrl` trong `lib/neon-url.ts`, có unit test). Runtime không dùng `DIRECT_URL`.
- `TICKET_SECRET` bắt buộc ngay từ P0 (dùng cho `ipHash` và ticket ở các phase sau).
- Thời điểm validate: ở `instrumentation.ts` (lúc server khởi động) và lần đầu import `env` phía server. **Không** validate trong `next.config.ts`, để `next build` không đòi secret thật.
- Chỉ import `lib/env.ts` phía server (`import "server-only"`). Client chỉ dùng trực tiếp `process.env.NEXT_PUBLIC_APP_URL`.
- Local dùng `.env.local`; Next và `prisma.config.ts` đều đọc file này. `.env*` nằm trong `.gitignore`, trừ `.env.example`.

---

## 12. Hướng dẫn UI

- shadcn components: Button, Input, Card, Table, Badge, Dialog, Switch, Tabs, Toast (sonner).
- Màn chiếu: chữ số liệu tối thiểu `text-5xl`, tương phản cao, có thể đọc từ cuối phòng.
- Form SV: một cột, nút gửi to, phản hồi tức thì (toast và trạng thái nút).
- Màu badge cờ: `UNKNOWN_STUDENT` vàng, `NAME_MISMATCH` cam, `DEVICE_MULTI_STUDENT` đỏ.
- Mọi thông báo lỗi bằng tiếng Việt, ngắn, nói rõ cần làm gì.

---

## 13. Kiểm thử

- **Unit (Vitest):** `stats.ts`, `normalize.ts` (bao gồm "Đào Anh Ngọc" và "dao anh ngoc" phải khớp nhau), `ticket.ts` (hợp lệ, hết hạn, sai chữ ký, sai round), validate điểm theo step.
- **Integration:** `submitRating` với DB test (Neon branch hoặc Postgres local qua Docker) cho các trường hợp BR-03, 06, 07, 08, 10.
- **E2E (Playwright):** GV đăng nhập (mock), tạo event, import roster, mở Nhóm 1, 3 SV gửi phiếu (1 phiếu tự chấm bị từ chối), dashboard hiển thị n=2, đóng phiên, export CSV.
- **Load (script k6 hoặc autocannon):** 100 submit trong 20 giây vào một round. Yêu cầu: không lỗi 5xx, p95 < 800ms.

---

## 14. Lộ trình theo phase

### P0: Khởi tạo (dừng sau phase)
- `git init`. Khởi tạo Next.js (App Router, TS strict, pnpm, ESLint), Tailwind v4, shadcn (Button, Input, Card, Sonner kèm `<Toaster/>` ở root layout).
- Prisma 7 + Neon adapter theo §4.1. Schema **chỉ có model `Lecturer`** (không có relation `events`), cùng migration đầu tiên `init`:
  - Có `DIRECT_URL` thật: chạy `prisma migrate dev --name init`.
  - Chưa có DB: sinh SQL offline bằng `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` vào `prisma/migrations/<timestamp>_init/migration.sql`, kèm `migration_lock.toml`.
- Auth.js (ban đầu là Google kèm allowlist, đã đổi sang tài khoản admin theo T16), `lib/env.ts` (§11), `proxy.ts` (§6), `instrumentation.ts`.
- Trang `/login` (form Email + Mật khẩu) và trang `/events` placeholder (hiện email GV, nút "Đăng xuất").
- `vercel.json`, scripts (§10), `README.md`, `CLAUDE.md`.
- Test P0: chỉ bắt buộc unit test cho `lib/env.ts`. Cuối phase chạy `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Nếu chưa có env thật thì build bằng `.env.local` giá trị giả (gitignored).
- Deploy lên Vercel và điền env thật do **chủ sản phẩm làm thủ công** theo README. Claude Code không deploy.
- **Nghiệm thu (chủ sản phẩm kiểm):** đăng nhập được bằng tài khoản admin, sai mật khẩu bị từ chối, `pnpm db:deploy` chạy được trên Neon.

### P1: MVP dùng được trên lớp
- Schema đầy đủ §4 kèm migration SQL bổ sung.
- CRUD event; quản lý nhóm thủ công (chưa cần roster).
- `openRound` / `closeRound` (BR-01, 02, 03).
- QR **tĩnh** (`rotatingQr=false`); trang `/r/[code]`; `submitRating` với BR-04, 05, 06.
- Trang live: QR, điều khiển, stats cơ bản (n, mean, median, highest, lowest), polling.
- `lib/stats.ts` kèm unit test.
- **Nghiệm thu:** Chạy thử end-to-end trên 2 điện thoại thật. Gửi lại thì cập nhật điểm. Mở nhóm mới thì nhóm cũ tự đóng.

**Làm rõ phạm vi P1** (đã chốt, xem thêm §17):
- **Chưa có roster ở P1:** bỏ qua BR-07/08/09/10. Phiếu được nhận chỉ cần qua BR-04/05/06, với `studentId = null`, `flags = []`, `excluded = false`. Tuy `strictRoster` mặc định là `true`, P1 **không** áp dụng nó; từ P2 mới áp dụng.
- **Chưa có ticket ở P1:** form SV gửi kèm `roundId` của nhóm đang hiển thị (hidden field) thay cho `ticket`. Server kiểm tra round thuộc đúng event (`eventCode`) và đang `OPEN`. Mục đích là SV đang xem "Nhóm 3" thì không thể vô tình chấm sang "Nhóm 4" khi GV vừa chuyển nhóm. Ở P3 `roundId` được thay bằng `ticket` ký HMAC (§9.2).
- **QR tĩnh:** event tạo ở P1 có `rotatingQr = false` (đặt khi tạo, giữ default `true` trong schema cho P3). UI chưa có công tắc này. QR trỏ tới `${NEXT_PUBLIC_APP_URL}/r/${code}`. Trang SV polling `GET /api/public/events/[code]/current` mỗi 3 giây để tự chuyển nhóm.
- **Cấu hình event chỉnh được ở P1:** tiêu đề, `minScore`, `maxScore` (trong [0, 10]), `scoreStep` (0.1 / 0.5 / 1), `studentCodePattern` (regex hợp lệ, ≤ 100 ký tự). Các trường còn lại dùng giá trị mặc định và sẽ mở ở phase dùng đến chúng.
- **Vòng đời event:** tạo (`ACTIVE`), sửa, lưu trữ (`ARCHIVED`) và khôi phục. Không xóa cứng. Event `ARCHIVED` không mở round được, và phải đóng round đang mở trước khi lưu trữ. `DRAFT` chưa dùng.
- **Nhóm thủ công:**
  - Thêm nhóm (tên mặc định "Nhóm N", `order = max + 1`), đổi tên, lên/xuống thứ tự (hoán đổi `order` trong transaction).
  - Xóa nhóm chỉ được khi nhóm **chưa có phiếu** và round không `OPEN`. Ngược lại báo "Không thể xóa nhóm đã có phiếu chấm."
  - Tên nhóm trim, dài 1–50 ký tự, không trùng trong event.
- **Stats P1** (`lib/stats.ts`): `n`, `mean`, `median`, `highest`, `lowest` theo đúng định nghĩa §8. `trimmedMean`, `stdDev`, `histogram`, `flaggedCount`, `excludedCount` bổ sung ở P2.
- **Hiển thị trên màn chiếu P1:** tên người chấm cao nhất/thấp nhất luôn hiện (cấu hình `hideRaterNamesOnProjector` làm ở P4).
- **Kiểm thử P1:** unit test (viết trước) cho `stats`, `normalize` (`normalizeCode`), validate điểm theo step, sinh mã event, `neon-url`, xác thực admin. Integration test với DB để ở P2 (§13).

### P2: Roster & kiểm soát chất lượng phiếu
- Import roster (TSV/CSV kèm preview); BR-07, 08, 09, 10; flags.
- Trang results: rà soát, loại/khôi phục phiếu, xếp hạng (BR-13), export CSV có BOM.
- Stats đầy đủ: trimmed mean, std, histogram, đếm phiếu cờ/loại.
- **Nghiệm thu:** Toàn bộ test integration ở §13 pass. File CSV mở đúng tiếng Việt trong Excel.

### P3: Chống gian lận nâng cao
- QR xoay vòng và ticket (§9.1, 9.2), rate limit theo device (§9.3).
- **Nghiệm thu:** Token cũ hơn 60 giây bị từ chối, ticket không dùng được cho round khác, unit test `ticket.ts` pass.

### P4: Hoàn thiện
- Dark mode, toàn màn hình, `hideRaterNamesOnProjector`, tối ưu UI màn chiếu.
- E2E Playwright và load test.
- **Nghiệm thu:** Load test đạt chỉ tiêu §13. Lighthouse mobile cho `/r/[code]` ≥ 90 Performance.

---

## 15. Định nghĩa "Xong" (áp dụng mọi phase)
- `pnpm typecheck && pnpm lint && pnpm test` pass.
- Không còn `any` hay `// @ts-ignore` mới.
- Đã cập nhật `.env.example` và `README.md` (setup local, migrate, deploy).
- Có tóm tắt thay đổi và các điểm cần chủ sản phẩm xác nhận.

---

## 16. Quyết định mở (chủ sản phẩm chốt)

| # | Câu hỏi | Mặc định đang dùng |
|---|---|---|
| D1 | Định dạng MSV của HPU (regex chính xác)? | `^[A-Z0-9]{5,15}$` |
| D2 | Bước điểm: 1 / 0.5 / 0.1? | 0.5 |
| D3 | Chỉ số xếp hạng chính: TB hay TB cắt hay trung vị? Tỷ lệ cắt? | TB cắt 10% |
| D4 | MSV ngoài roster: từ chối hay nhận kèm cờ? | Từ chối (`strictRoster=true`) |
| D5 | Phiếu `DEVICE_MULTI_STUDENT`: tự loại hay chỉ gắn cờ? | Tự loại |
| D6 | Có hiển thị tên người chấm cao/thấp nhất trên màn chiếu không? | Có (tắt được bằng cấu hình) |
| D7 | SV có được sửa điểm khi phiên còn mở không? | Có (upsert) |
| D8 | Có cần nhiều GV cùng quản lý một event không? | Không (chỉ owner) |
| D9 | Điểm SV chấm dùng thế nào: hiển thị tham khảo hay quy đổi vào điểm thành phần? Nếu quy đổi thì cần thêm công thức kết hợp với điểm GV. | Chỉ tham khảo |
| D10 | Có cần rate limit cho form đăng nhập admin không (bảng đếm lần sai trong Neon, hoặc Vercel WAF)? | Chưa có. Chỉ dựa vào mật khẩu ≥ 16 ký tự ngẫu nhiên |

---

## 17. Quyết định kỹ thuật đã chốt (trước P0)

| # | Vấn đề | Quyết định |
|---|---|---|
| T1 | Tên file spec | `SPEC.md` ở thư mục gốc |
| T2 | Next 16 bỏ `middleware.ts` | Dùng `proxy.ts`, quy tắc ở §6 |
| T3 | Prisma 7 bỏ `url`/`directUrl` trong schema và `prisma-client-js` | Cấu hình theo §4.1: `prisma-client` + `output`, URL nằm trong `prisma.config.ts`, không `previewFeatures` |
| T4 | Đọc `.env` cho Prisma CLI | `process.loadEnvFile` của Node, không thêm `dotenv` |
| T5 | Neon driver mode | `PrismaNeon` (WebSocket Pool), không `ws` vì Node ≥ 22 |
| T6 | Auth.js v5 chưa stable | Pin `next-auth@5.0.0-beta.32` |
| T7 | TypeScript | 5.9.x |
| T8 | Dependency phụ | Theo danh sách ở §3, gồm cả `next-themes` |
| T9 | Thời điểm validate env | `instrumentation.ts` + lần import đầu, không validate trong `next.config.ts` (§11) |
| T10 | Migration production | Thủ công qua `pnpm db:deploy`, không gắn vào build Vercel (§10) |
| T11 | Upsert Lecturer | Tạo nếu chưa có, cập nhật `name` mỗi lần đăng nhập (§9.5) |
| T12 | Module format | `"type": "module"` |
| T13 | Migration khi chưa có DB | Sinh offline bằng `prisma migrate diff` (§14 P0) |
| T14 | Deploy Vercel ở P0 | Chủ sản phẩm làm thủ công theo README |
| T15 | Git | `git init`, commit khởi tạo trực tiếp lên `main` |
| T16 | Google OAuth (P0) | **Bỏ** theo quyết định của chủ sản phẩm (23/10/2026). Thay bằng 1 tài khoản admin qua Credentials provider (§9.5). Bỏ env `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_LECTURER_EMAILS`; thêm `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| T17 | `DIRECT_URL` không có trên console Neon | Biến tùy chọn, tự suy ra từ `DATABASE_URL` (§11) |
| T18 | P1 chưa có ticket/roster | Dùng `roundId` thay ticket; bỏ qua BR-07..10 (§14 P1) |
| T19 | Thư viện form ở P1 | Form dùng Server Action + `useActionState`, lỗi theo từng trường do server trả về. `react-hook-form` chỉ thêm khi form cần validate phía client phức tạp (P2 import roster) |
| T20 | `cn` | Dùng package `cn` do shadcn CLI cài (của shadcn-ui, thay cho `clsx` + `tailwind-merge`) |
| T21 | HTTP 404 trên trang có streaming | Với Cache Components/PPR, `notFound()` bên trong `<Suspense>` vẫn trả HTTP 200, nhưng hiển thị trang 404 tiếng Việt kèm `noindex`. Event không tồn tại và event của người khác hiển thị **giống hệt nhau**, nên không lộ thông tin. Route handler `/api/*` vẫn trả HTTP 404 thật |
| T22 | Proxy và `/api/auth/*` | Proxy matcher bỏ qua `/api/auth/*`, vì chạy wrapper `auth()` ở đó sẽ đặt thêm một cookie CSRF thứ hai gây xung đột |
| T24 | Đổi cấu hình khi đã có phiếu | Khi event **đã có phiếu**, không đổi được `minScore`/`maxScore`/`scoreStep`/`studentCodePattern`, vì phiếu cũ đã được kiểm tra theo quy tắc cũ (BR-04/05). Tên vẫn đổi được. Event `ARCHIVED` không sửa được cấu hình và nhóm (kiểm tra ở server, không chỉ ở UI) |
| T25 | `studentCodePattern` (chống ReDoS) | Luôn so khớp **toàn bộ** MSV (tự bọc `^(?:…)$`). Khi lưu, từ chối nhóm lặp lồng nhau (`(a+)+`), lookaround và backreference |
| T26 | Race giữa gửi phiếu và đóng phiên | `submitRating` khóa dòng Round bằng `SELECT … FOR SHARE` trong transaction, nên phiếu không lọt vào sau khi `closeRound`/`openRound` commit |
| T23 | Trang public không đọc cookie | Gọi `await connection()` trước khi truy vấn DB (Cache Components), nếu không Next báo lỗi "unstable value" khi prerender |

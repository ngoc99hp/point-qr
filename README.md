# PeerScore

PeerScore cho sinh viên chấm điểm phần thuyết trình của nhóm bạn bằng cách quét mã QR. Giảng viên xem kết quả theo thời gian thực trên màn chiếu.
Đặc tả đầy đủ nằm trong [SPEC.md](SPEC.md). Trạng thái hiện tại: **P0, khung dự án** (đăng nhập giảng viên, chưa có nghiệp vụ chấm điểm).

**Stack:**
- Next.js 16 (App Router, Cache Components), TypeScript 5.9 strict
- Tailwind v4 và shadcn/ui
- Prisma 7 với `@prisma/adapter-neon`, chạy trên Neon Postgres (Singapore)
- Auth.js v5 (Google, JWT)
- Vitest; deploy lên Vercel (`sin1`)

## Yêu cầu

- Node.js ≥ 22 (khuyến nghị bản LTS 22 hoặc 24)
- pnpm (phiên bản ghi trong `packageManager` của `package.json`; bật bằng `corepack enable`)
- Một project trên Neon và một OAuth client của Google

## Cài đặt local

```bash
pnpm install                 # tự chạy `prisma generate` (postinstall)
cp .env.example .env.local   # rồi điền giá trị thật (xem bảng dưới)
pnpm db:deploy               # áp dụng migration lên DB trong DIRECT_URL
pnpm dev                     # http://localhost:3000
```

Next.js và `prisma.config.ts` đều đọc `.env.local`. Không commit file này.

## Biến môi trường

Ứng dụng validate biến môi trường bằng Zod trong [lib/env.ts](lib/env.ts). Server sẽ không khởi động nếu thiếu biến hoặc biến sai định dạng; thông báo lỗi chỉ liệt kê **tên** biến, không in giá trị.

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string **pooled** của Neon (host có `-pooler`). Ứng dụng dùng lúc runtime |
| `DIRECT_URL` | Connection string **direct** của Neon (host không có `-pooler`). Prisma CLI dùng để migrate |
| `AUTH_SECRET` | ≥ 32 ký tự ngẫu nhiên: `npx auth secret` hoặc `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Lấy từ Google OAuth client |
| `ALLOWED_LECTURER_EMAILS` | Danh sách email giảng viên được phép đăng nhập, phân tách bằng dấu phẩy, không phân biệt hoa thường |
| `TICKET_SECRET` | ≥ 32 ký tự ngẫu nhiên: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | URL gốc của ứng dụng, ví dụ `http://localhost:3000` hoặc `https://<domain>` |
| `AUTH_TRUST_HOST` | *Tùy chọn.* Đặt `true` khi chạy `pnpm start` ở local hoặc tự host ngoài Vercel |

Lấy connection string trên Neon: **Dashboard → Connect**, chọn region `aws-ap-southeast-1`. Bật **Connection pooling** để lấy `DATABASE_URL`, tắt đi để lấy `DIRECT_URL`.

## Google OAuth

1. Vào Google Cloud Console → **APIs & Services → OAuth consent screen**. Chọn loại *Internal* nếu dùng Google Workspace của trường, nếu không thì chọn *External*.
2. Vào **Credentials → Create credentials → OAuth client ID**, chọn loại *Web application*.
3. Điền **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<domain-production>/api/auth/callback/google`
4. Chép Client ID và Client secret vào `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET`.

## Database và migration

| Lệnh | Khi nào dùng |
|---|---|
| `pnpm db:migrate` | Khi đang phát triển: tạo migration mới từ `prisma/schema.prisma` và áp dụng lên DB dev (`prisma migrate dev`) |
| `pnpm db:deploy` | Áp dụng các migration đã commit lên DB (`prisma migrate deploy`). Dùng cho DB production |

- Cả hai lệnh đều dùng `DIRECT_URL`, được cấu hình trong [prisma.config.ts](prisma.config.ts).
- Migration production **chạy thủ công** từ máy có `DIRECT_URL` của production. Build trên Vercel **không** tự migrate.
- Prisma Client được sinh vào `lib/generated/prisma` (đã gitignore) mỗi lần `pnpm install`.

## Kiểm tra chất lượng

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Deploy lên Vercel

1. Push repo lên GitHub rồi import project vào Vercel (framework Next.js, Vercel tự nhận pnpm).
2. Vào **Settings → Environment Variables** và thêm toàn bộ biến ở bảng trên, trừ `AUTH_TRUST_HOST`.
   - `NEXT_PUBLIC_APP_URL` đặt bằng domain production.
   - Nếu dùng Preview deployment, nên trỏ `DATABASE_URL`/`DIRECT_URL` của Preview sang một Neon branch riêng.
3. Region của function đã được cố định là `sin1` trong [vercel.json](vercel.json), cùng region với Neon.
4. Trước lần deploy đầu tiên, hoặc khi có migration mới, chạy ở máy local với `DIRECT_URL` production:
   ```bash
   pnpm db:deploy
   ```
5. Thêm redirect URI production vào Google OAuth client (xem phần Google OAuth).
6. Nghiệm thu P0:
   - đăng nhập được bằng email có trong allowlist;
   - email ngoài allowlist bị từ chối và thấy thông báo "Email này không có quyền truy cập…".

## Cấu trúc chính

```
app/(auth)/login         trang đăng nhập
app/(dashboard)/events   trang danh sách buổi đánh giá (placeholder ở P0)
app/api/auth/[...]       handler Auth.js
auth.config.ts           cấu hình Auth.js dùng chung cho proxy (không import Prisma)
lib/auth.ts              Auth.js đầy đủ: allowlist, upsert Lecturer, requireLecturer()
lib/db.ts                Prisma Client singleton dùng Neon adapter
lib/env.ts               validate biến môi trường
proxy.ts                 bảo vệ route (Next 16 thay middleware.ts)
prisma/                  schema và migrations
```

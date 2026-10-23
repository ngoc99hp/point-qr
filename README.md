# PeerScore

PeerScore cho sinh viên chấm điểm phần thuyết trình của nhóm bạn bằng cách quét mã QR. Giảng viên xem kết quả theo thời gian thực trên màn chiếu.
Đặc tả đầy đủ nằm trong [SPEC.md](SPEC.md). Trạng thái hiện tại: **P2 đã xong.**
- Đã có: tạo buổi đánh giá, nhập danh sách lớp kèm nhóm, mở/đóng phiên chấm, QR tĩnh, form chấm cho sinh viên (kiểm tra MSV ngay khi nhập), màn chiếu realtime (điểm trung bình kèm danh sách người chấm), gắn cờ và tự loại phiếu nghi vấn, trang kết quả kèm xếp hạng và xuất CSV.
- Còn lại: QR xoay vòng, ticket, rate limit (P3); dark mode, toàn màn hình, E2E/load test (P4).

**Stack:**
- Next.js 16 (App Router, Cache Components), TypeScript 5.9 strict
- Tailwind v4 và shadcn/ui; TanStack Query (polling); `qrcode` (render QR phía client)
- Prisma 7 với `@prisma/adapter-neon`, chạy trên Neon Postgres (Singapore)
- Auth.js v5 (1 tài khoản admin, JWT)
- Vitest; deploy lên Vercel (`sin1`)

## Yêu cầu

- Node.js ≥ 22 (khuyến nghị bản LTS 22 hoặc 24)
- pnpm (phiên bản ghi trong `packageManager` của `package.json`; bật bằng `corepack enable`)
- Một project trên Neon

## Cài đặt local

```bash
pnpm install                 # tự chạy `prisma generate` (postinstall)
cp .env.example .env.local   # rồi điền giá trị thật (xem bảng dưới)
pnpm db:deploy               # áp dụng migration lên DB Neon (kết nối direct)
pnpm dev                     # http://localhost:3000
```

Next.js và `prisma.config.ts` đều đọc `.env.local`. Không commit file này.

## Biến môi trường

Ứng dụng validate biến môi trường bằng Zod trong [lib/env.ts](lib/env.ts). Server sẽ không khởi động nếu thiếu biến hoặc biến sai định dạng; thông báo lỗi chỉ liệt kê **tên** biến, không in giá trị.

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string **pooled** của Neon (host có `-pooler`). Ứng dụng dùng lúc runtime |
| `DIRECT_URL` | *Tùy chọn.* Connection string **direct** (host không có `-pooler`) cho Prisma CLI. Bỏ trống thì tự suy ra từ `DATABASE_URL` |
| `AUTH_SECRET` | ≥ 32 ký tự ngẫu nhiên: `npx auth secret` hoặc `openssl rand -base64 32` |
| `ADMIN_EMAIL` | Email của tài khoản admin duy nhất |
| `ADMIN_PASSWORD` | Mật khẩu admin, **≥ 16 ký tự** (ví dụ `openssl rand -base64 24`) |
| `TICKET_SECRET` | ≥ 32 ký tự ngẫu nhiên: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | URL gốc của ứng dụng, ví dụ `http://localhost:3000` hoặc `https://<domain>` |
| `AUTH_TRUST_HOST` | *Tùy chọn.* Đặt `true` khi chạy `pnpm start` ở local hoặc tự host ngoài Vercel |

Lấy connection string trên Neon: **Dashboard → Connect**, chọn region `aws-ap-southeast-1`, bật **Connection pooling** rồi chép vào `DATABASE_URL`. Không cần khai báo `DIRECT_URL`: URL direct chính là URL đó bỏ `-pooler` khỏi host, và [prisma.config.ts](prisma.config.ts) tự suy ra.

## Tài khoản admin

Ứng dụng chỉ có **một tài khoản** quản trị, khai báo bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD`. Lần đăng nhập đầu tiên sẽ tạo bản ghi `Lecturer` tương ứng. Muốn đổi mật khẩu thì sửa biến môi trường rồi khởi động lại hoặc deploy lại. Đổi `ADMIN_EMAIL` sẽ làm mất hiệu lực các phiên đăng nhập cũ.

## Database và migration

| Lệnh | Khi nào dùng |
|---|---|
| `pnpm db:migrate` | Khi đang phát triển: tạo migration mới từ `prisma/schema.prisma` và áp dụng lên DB dev (`prisma migrate dev`) |
| `pnpm db:deploy` | Áp dụng các migration đã commit lên DB (`prisma migrate deploy`). Dùng cho DB production |

- Cả hai lệnh đều dùng kết nối direct (`DIRECT_URL` hoặc URL suy ra từ `DATABASE_URL`), cấu hình trong [prisma.config.ts](prisma.config.ts).
- Nếu lệnh báo `P1001: Can't reach database server`, nhiều khả năng compute Neon đang ngủ (gói free tự suspend). Chạy lại lệnh sau vài giây.
- Migration production **chạy thủ công** từ máy có connection string của DB production. Build trên Vercel **không** tự migrate.
- Prisma Client được sinh vào `lib/generated/prisma` (đã gitignore) mỗi lần `pnpm install`.

## Cách dùng trên lớp

1. Đăng nhập tại `/login` bằng tài khoản admin.
2. Vào **Buổi đánh giá** và tạo một buổi mới. Mỗi buổi có một mã 6 ký tự.
3. Ở trang thiết lập, mục **Danh sách lớp**, dán bảng từ Excel gồm 3 cột `MSV | Họ tên | Nhóm` (có dòng tiêu đề), hoặc chọn file CSV.
   - Xem trước để kiểm tra lỗi từng dòng, rồi bấm **Xác nhận nhập danh sách**.
   - Nhóm được tạo tự động và xếp theo số trong tên nhóm.
   - Nếu cần, chỉnh bước điểm, độ dài MSV (mặc định 5–15 chữ số) và chỉ số xếp hạng.
4. Bấm **Mở màn chiếu** rồi chiếu trang này lên. Sinh viên quét mã QR, mở `/r/<mã>`.
5. Khi một nhóm trình bày xong, chọn nhóm đó rồi bấm **Mở chấm**, hoặc bấm **Nhóm tiếp →**. Mở nhóm mới sẽ tự đóng nhóm đang mở.
6. Sinh viên nhập MSV, họ tên, chọn điểm rồi gửi.
   - Trang báo ngay nếu MSV không có trong danh sách hoặc sinh viên đang chấm chính nhóm mình.
   - Gửi lại khi phiên còn mở thì điểm cũ được cập nhật.
   - Màn chiếu hiện điểm trung bình và danh sách người đã chấm, xếp từ cao đến thấp.
7. Bấm **Đóng** khi kết thúc. Vào **Kết quả** để xem bảng xếp hạng, rà soát phiếu có cờ, loại hoặc khôi phục phiếu, và tải CSV (mở được bằng Excel, hiển thị đúng tiếng Việt).

Các cờ trên phiếu:
- **Sai tên**: họ tên nhập vào khác tên trong danh sách. So sánh không phân biệt dấu.
- **Trùng thiết bị**: một điện thoại gửi phiếu cho nhiều MSV. Phiếu này **tự bị loại**.
- **Ngoài danh sách**: chỉ xuất hiện khi bạn tắt "Chỉ nhận MSV có trong danh sách lớp".

Lưu ý:
- QR trỏ tới `NEXT_PUBLIC_APP_URL`, nên giá trị này phải là địa chỉ **điện thoại truy cập được**. `localhost` chỉ dùng được trên chính máy đang chạy app.
- Để thử trên điện thoại thật khi chạy local: đặt `NEXT_PUBLIC_APP_URL=http://<IP-LAN-của-máy>:3000` (máy tính và điện thoại cùng Wi-Fi), chạy `pnpm dev -H 0.0.0.0`, và mở port 3000 trên Windows Firewall nếu cần. Cách đơn giản hơn là deploy lên Vercel rồi thử bằng domain thật.
- Gói free của Neon tự suspend khi không có truy cập. Hãy mở màn chiếu vài phút trước giờ học để "làm nóng" DB.

## Kiểm tra chất lượng

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:integration   # chạy trên DB Neon trong .env.local, tự tạo và tự xóa dữ liệu [TEST]
```

## Deploy lên Vercel

1. Push repo lên GitHub rồi import project vào Vercel (framework Next.js, Vercel tự nhận pnpm).
2. Vào **Settings → Environment Variables** và thêm toàn bộ biến ở bảng trên, trừ `AUTH_TRUST_HOST`.
   - `NEXT_PUBLIC_APP_URL` đặt bằng domain production.
   - Nếu dùng Preview deployment, nên trỏ `DATABASE_URL`/`DIRECT_URL` của Preview sang một Neon branch riêng.
3. Region của function đã được cố định là `sin1` trong [vercel.json](vercel.json), cùng region với Neon.
4. Trước lần deploy đầu tiên, hoặc khi có migration mới, chạy ở máy local với `DATABASE_URL` production:
   ```bash
   pnpm db:deploy
   ```
5. Nghiệm thu P1 (SPEC §14): chạy thử trọn luồng trên 2 điện thoại thật. Gửi lại thì điểm được cập nhật; mở nhóm mới thì nhóm cũ tự đóng.

## Cấu trúc chính

```
app/(auth)/login               đăng nhập admin (form + Server Action)
app/(dashboard)/events         danh sách và tạo buổi đánh giá
app/(dashboard)/events/[id]    thiết lập: cấu hình, nhóm, lưu trữ
app/(dashboard)/events/[id]/live  màn chiếu: QR, điểm TB + danh sách người chấm, điều khiển phiên
app/(dashboard)/events/[id]/results  xếp hạng, rà soát/loại phiếu, xuất CSV
app/api/events/[id]/export     GET ?type=summary|raw → CSV UTF-8 có BOM
app/r/[code]                   form chấm của sinh viên (public, mobile-first)
app/actions/                   Server Actions: events, roster (nhóm), rounds, ratings
app/api/events/[id]/live       GET snapshot cho màn chiếu (cần đăng nhập)
app/api/public/events/[code]/current  GET nhóm đang mở (public)
lib/data/                      truy vấn có lọc ownerId, snapshot live, dữ liệu public
lib/stats.ts, score.ts, normalize.ts, roster.ts, ranking.ts, csv.ts, rating-rules.ts   hàm thuần, có unit test
lib/ratings/                   lõi submitRating / checkStudentCode (có integration test)
tests/integration/             test chạy trên DB thật, tự dọn dữ liệu
lib/auth.ts                    Auth.js (Credentials admin), requireLecturer()
lib/db.ts, lib/env.ts          Prisma singleton (Neon adapter), validate env
proxy.ts                       bảo vệ route (Next 16 thay middleware.ts)
prisma/                        schema và migrations
```

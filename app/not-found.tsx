import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <p className="max-w-sm text-muted-foreground">
        Đường dẫn không đúng hoặc buổi đánh giá không còn tồn tại. Nếu bạn là sinh viên, hãy quét
        lại mã QR trên màn chiếu.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Về trang chủ
      </Link>
    </main>
  );
}

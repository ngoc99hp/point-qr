import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand";
import { getLoginErrorMessage } from "@/lib/login-error";
import { safeCallbackUrl } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập · PeerScore" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />
      <section className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <BrandLogo className="mb-10 lg:hidden" />
          <h1 className="text-3xl font-extrabold">Chào thầy cô 👋</h1>
          <p className="mt-2 mb-8 text-muted-foreground">Đăng nhập để mở buổi đánh giá và theo dõi điểm trực tiếp.</p>
          <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5">
            <Suspense fallback={<div className="h-48 rounded-md bg-muted" />}>
              <LoginFormFromParams searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Decorative left panel: gradient, tagline and a floating "live score" composition. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-black/10 blur-3xl" />
      <span className="relative inline-flex items-center gap-2.5 text-xl font-extrabold">
        <span className="inline-grid size-9 place-items-center rounded-xl bg-white/20 ring-1 ring-white/40">✓</span>
        PeerScore
      </span>
      <div className="relative">
        <p className="max-w-md text-5xl font-extrabold leading-[1.05]">Quét mã. Chấm điểm. Thấy ngay kết quả.</p>
        <p className="mt-5 max-w-md text-lg text-white/85">
          Sinh viên chấm bài thuyết trình của nhóm bạn ngay trên điện thoại — giảng viên xem điểm trung bình theo thời gian thực.
        </p>
      </div>
      <div aria-hidden className="relative flex flex-wrap gap-3">
        {[
          { label: "Nhóm 3", value: "8,75" },
          { label: "Phiếu", value: "42" },
          { label: "Cao nhất", value: "10" },
        ].map((chip, index) => (
          <div
            key={chip.label}
            className="rounded-2xl bg-white/15 px-5 py-3 ring-1 ring-white/30 backdrop-blur-sm"
            style={{ transform: `rotate(${[-3, 2, -1][index]}deg)` }}
          >
            <div className="text-xs uppercase tracking-wider text-white/75">{chip.label}</div>
            <div className="text-3xl font-extrabold tabular-nums">{chip.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

async function LoginFormFromParams({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      callbackUrl={safeCallbackUrl(firstParam(params.callbackUrl))}
      initialError={getLoginErrorMessage(firstParam(params.error))}
    />
  );
}

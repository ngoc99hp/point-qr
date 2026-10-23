"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryProvider } from "@/components/query-provider";
import { LOGIN_PATH } from "@/lib/routes";
import type { LiveResponse } from "@/lib/types/live";
import { LiveSummary, RaterList } from "./live-stats";
import { QrCode } from "./qr-code";
import { RoundControls } from "./round-controls";

const POLL_OPEN_MS = 2_000;
const POLL_IDLE_MS = 10_000;

interface LiveScreenProps {
  eventId: string;
  /** Absolute student URL encoded in the static QR (P1). */
  studentUrl: string;
}

export function LiveScreen(props: LiveScreenProps) {
  return (
    <QueryProvider>
      <LiveScreenContent {...props} />
    </QueryProvider>
  );
}

class UnauthorizedError extends Error {}

async function fetchLive(eventId: string): Promise<LiveResponse> {
  const response = await fetch(`/api/events/${eventId}/live`, { cache: "no-store" });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(`live ${response.status}`);
  return (await response.json()) as LiveResponse;
}

function LiveScreenContent({ eventId, studentUrl }: LiveScreenProps) {
  const queryClient = useQueryClient();
  const queryKey = ["live", eventId];
  const router = useRouter();
  const pathname = usePathname();
  const { data, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchLive(eventId),
    // SPEC §6.2: 2s while a round is open, 10s otherwise; pause when the tab is hidden.
    refetchInterval: (query) => (query.state.data?.current ? POLL_OPEN_MS : POLL_IDLE_MS),
    refetchIntervalInBackground: false,
    retry: (failureCount, queryError) => !(queryError instanceof UnauthorizedError) && failureCount < 1,
  });

  // Session expired (12h): back to login, then return to this screen.
  useEffect(() => {
    if (error instanceof UnauthorizedError) {
      router.replace(`${LOGIN_PATH}?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [error, router, pathname]);

  if (!data) {
    return (
      <p className="text-muted-foreground">
        {isError ? "Không tải được dữ liệu. Đang thử lại…" : "Đang tải…"}
      </p>
    );
  }

  const displayUrl = studentUrl.replace(/^https?:\/\//, "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.event.title}</h1>
          <p className="text-4xl font-bold md:text-5xl" aria-live="polite">
            {data.current ? `Đang chấm: ${data.current.groupName}` : "Chưa mở phiên chấm"}
          </p>
        </div>
        {isError ? <p className="text-sm text-destructive">Mất kết nối, đang thử lại…</p> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Mã QR" className="flex flex-col items-center gap-3">
          <QrCode value={studentUrl} label={`Mã QR dẫn tới ${displayUrl}`} />
          <p className="break-all text-center font-mono text-xl md:text-2xl">{displayUrl}</p>
        </section>
        <section aria-label="Thống kê" className="flex flex-col gap-6">
          {data.current ? (
            <>
              <LiveSummary stats={data.current.stats} />
              <RaterList ratings={data.current.ratings} />
            </>
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-xl text-muted-foreground">
              Chọn nhóm rồi bấm &quot;Mở chấm&quot; để sinh viên bắt đầu gửi điểm.
            </p>
          )}
        </section>
      </div>

      <section aria-label="Điều khiển" className="border-t pt-4">
        <RoundControls snapshot={data} onChanged={() => queryClient.invalidateQueries({ queryKey })} />
      </section>
    </div>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize, Minimize, ScanLine } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { QueryProvider } from "@/components/query-provider";
import { StatusPill } from "@/components/status-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/routes";
import type { LiveResponse } from "@/lib/types/live";
import { cn } from "@/lib/utils";
import { LiveSummary, RaterList } from "./live-stats";
import { QrCode } from "./qr-code";
import { RoundControls } from "./round-controls";
import { useFullscreen } from "./use-fullscreen";
import { useQrValue } from "./use-qr-value";

const POLL_OPEN_MS = 2_000;
const POLL_IDLE_MS = 10_000;

interface LiveScreenProps {
  eventId: string;
  /** Absolute student URL (the QR adds `?t=` when rotating). */
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
  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);
  const { data, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchLive(eventId),
    // SPEC §6.2: 2s while a round is open, 10s otherwise; pause when the tab is hidden.
    refetchInterval: (query) => (query.state.data?.current ? POLL_OPEN_MS : POLL_IDLE_MS),
    refetchIntervalInBackground: false,
    retry: (failureCount, queryError) => !(queryError instanceof UnauthorizedError) && failureCount < 1,
  });
  const qrValue = useQrValue({
    eventId,
    studentUrl,
    rotatingQr: data?.event.rotatingQr ?? false,
    openRoundId: data?.current?.roundId ?? null,
  });

  // Session expired (12h): back to login, then return to this screen.
  useEffect(() => {
    if (error instanceof UnauthorizedError) {
      router.replace(`${LOGIN_PATH}?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [error, router, pathname]);

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-6", fullscreen.isFullscreen && "overflow-auto bg-background p-6 md:p-10")}>
      {data ? (
        <LiveBoard
          data={data}
          qrValue={qrValue}
          studentUrl={studentUrl}
          isOffline={isError}
          fullscreen={fullscreen}
          onChanged={() => queryClient.invalidateQueries({ queryKey })}
        />
      ) : (
        <p className="text-muted-foreground">{isError ? "Không tải được dữ liệu. Đang thử lại…" : "Đang tải…"}</p>
      )}
    </div>
  );
}

interface LiveBoardProps {
  data: LiveResponse;
  qrValue: string | null;
  studentUrl: string;
  isOffline: boolean;
  fullscreen: ReturnType<typeof useFullscreen>;
  onChanged: () => void;
}

/** D3 layout: QR left; mean + rater list right; controls below. */
function LiveBoard({ data, qrValue, studentUrl, isOffline, fullscreen, onChanged }: LiveBoardProps) {
  const displayUrl = studentUrl.replace(/^https?:\/\//, "");
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {data.current ? <StatusPill tone="live">TRỰC TIẾP</StatusPill> : <StatusPill tone="idle">Chờ mở phiên</StatusPill>}
            <h1 className="text-xl font-semibold text-muted-foreground">{data.event.title}</h1>
          </div>
          <p className="text-5xl font-extrabold md:text-7xl" aria-live="polite">
            {data.current ? `Đang chấm: ${data.current.groupName}` : "Chưa mở phiên chấm"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOffline ? <p className="text-sm text-destructive">Mất kết nối, đang thử lại…</p> : null}
          <ThemeToggle />
          {fullscreen.isSupported ? (
            <Button variant="outline" onClick={fullscreen.toggle}>
              {fullscreen.isFullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              {fullscreen.isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-label="Mã QR" className="flex flex-col items-center gap-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground">
            <ScanLine aria-hidden className="size-4" /> Quét mã để chấm điểm
          </p>
          {qrValue ? (
            <QrCode value={qrValue} label={`Mã QR dẫn tới ${displayUrl}`} />
          ) : (
            <div className="flex aspect-square w-full max-w-[min(62vh,100%)] items-center justify-center rounded-3xl bg-muted text-muted-foreground">
              Đang tạo mã QR…
            </div>
          )}
          <p className="break-all rounded-2xl border bg-card px-4 py-2 text-center font-mono text-xl font-semibold md:text-2xl">
            {displayUrl}
          </p>
          {data.event.rotatingQr ? (
            <p className="text-center text-sm text-muted-foreground">Mã QR tự đổi mỗi 30 giây — hãy quét trực tiếp tại lớp.</p>
          ) : null}
        </section>
        <section aria-label="Thống kê" className="flex min-w-0 flex-col gap-6">
          {data.current ? (
            <>
              <LiveSummary stats={data.current.stats} />
              <RaterList ratings={data.current.ratings} />
            </>
          ) : (
            <p className="rounded-3xl border-2 border-dashed p-10 text-center text-xl text-muted-foreground">
              Chọn nhóm rồi bấm &quot;Mở chấm&quot; để sinh viên bắt đầu gửi điểm.
            </p>
          )}
        </section>
      </div>

      <section aria-label="Điều khiển" className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur md:p-5">
        <RoundControls snapshot={data} onChanged={onChanged} />
      </section>
    </>
  );
}

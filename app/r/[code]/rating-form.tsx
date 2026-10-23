"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FieldError } from "@/components/field-error";
import { QueryProvider } from "@/components/query-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseStudent, readStudentRaw } from "@/lib/student-storage";
import { resolveStudentSession, type RescanReason } from "@/lib/student-session";
import type { IssuedTicket, PublicCurrentResponse } from "@/lib/types/live";
import { ScoreGrid } from "./score-grid";
import { useRatingSubmission } from "./use-rating-submission";
import { useStudentCodeCheck } from "./use-student-code-check";

const POLL_CURRENT_MS = 3_000;
const subscribeNoop = () => () => {};
const formatScore = (score: number) => String(score).replace(".", ",");

const RESCAN_MESSAGE: Record<RescanReason, string> = {
  MISSING: "Vui lòng quét mã QR trên màn chiếu để bắt đầu chấm.",
  EXPIRED: "Phiên chấm của bạn đã hết hạn (15 phút). Vui lòng quét lại mã QR trên màn chiếu.",
  NEW_GROUP: "Giảng viên đã mở chấm nhóm khác. Vui lòng quét lại mã QR trên màn chiếu.",
  CLOSED: "Phiên chấm đã đóng.",
};

interface RatingFormProps {
  eventCode: string;
  eventTitle: string;
  scoreOptions: number[];
  initialCurrent: PublicCurrentResponse;
  /** Ticket obtained by scanning a rotating QR (null for static QR or a bad token). */
  entryTicket: IssuedTicket | null;
}

export function RatingForm(props: RatingFormProps) {
  return (
    <QueryProvider>
      <RatingFormContent {...props} />
    </QueryProvider>
  );
}

async function fetchCurrent(eventCode: string): Promise<PublicCurrentResponse> {
  const response = await fetch(`/api/public/events/${eventCode}/current`, { cache: "no-store" });
  if (!response.ok) throw new Error(`current ${response.status}`);
  return (await response.json()) as PublicCurrentResponse;
}

/** The QR token has been exchanged; drop it from the address bar, history and Referer. */
function useStripQrToken() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", url);
  }, []);
}

function RatingFormContent({ eventCode, eventTitle, scoreOptions, initialCurrent, entryTicket }: RatingFormProps) {
  useStripQrToken();
  const { data, refetch } = useQuery({
    queryKey: ["current", eventCode],
    queryFn: () => fetchCurrent(eventCode),
    initialData: initialCurrent,
    refetchInterval: POLL_CURRENT_MS,
    refetchIntervalInBackground: false,
    // initialData comes from the server render; don't refetch immediately on mount.
    staleTime: POLL_CURRENT_MS - 500,
  });
  // Ticket expiry is judged on the server's clock from the latest poll, never the phone's.
  const session = resolveStudentSession({
    rotatingQr: data.event.rotatingQr,
    current: data.current,
    entryTicket,
    now: data.serverNow,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{eventTitle}</p>
        <h1 className="text-3xl font-bold leading-tight" aria-live="polite">
          {session.kind === "ACTIVE" ? `Đang chấm: ${session.ticket.groupName}` : "Chưa có phiên chấm"}
        </h1>
      </header>
      {session.kind === "ACTIVE" ? (
        <ScoringForm
          key={session.ticket.roundId}
          eventCode={eventCode}
          ticket={session.ticket}
          scoreOptions={scoreOptions}
          onStale={() => void refetch()}
        />
      ) : (
        <p role="status" className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          {session.kind === "RESCAN"
            ? RESCAN_MESSAGE[session.reason]
            : "Chưa có nhóm nào đang mở chấm. Trang sẽ tự cập nhật khi giảng viên mở phiên."}
        </p>
      )}
    </div>
  );
}

interface ScoringFormProps {
  eventCode: string;
  ticket: IssuedTicket;
  scoreOptions: number[];
  /** Ask the parent to re-poll (closed round, expired/invalid ticket). */
  onStale: () => void;
}

/** One round's form; keyed by roundId so score/errors reset when the group changes. */
function ScoringForm({ eventCode, ticket, scoreOptions, onStale }: ScoringFormProps) {
  // Autofill from localStorage without an effect (server snapshot: nothing stored).
  const storedRaw = useSyncExternalStore(subscribeNoop, () => readStudentRaw(), () => null);
  const stored = useMemo(() => parseStudent(storedRaw), [storedRaw]);
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const studentCode = codeDraft ?? stored?.studentCode ?? "";
  const studentName = nameDraft ?? stored?.studentName ?? "";

  const { errors, submitted, isPending, submit } = useRatingSubmission(onStale);
  const codeCheck = useStudentCodeCheck({ eventCode, roundId: ticket.roundId, ticket: ticket.value, studentCode });
  // D4: server-side submit errors win; otherwise show the live roster hint.
  const studentCodeError = errors.studentCode ?? codeCheck.hint;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit({ eventCode, ticket: ticket.value, studentCode, studentName, score });
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {submitted ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          Bạn đã {submitted.status === "created" ? "gửi" : "cập nhật"} <strong>{formatScore(submitted.score)} điểm</strong>{" "}
          cho {ticket.groupName}. Gửi lại nếu muốn sửa điểm.
        </p>
      ) : null}
      <TextField
        id="studentCode"
        label="Mã sinh viên"
        value={studentCode}
        onChange={setCodeDraft}
        onBlur={codeCheck.checkNow}
        error={studentCodeError}
        disabled={isPending}
        inputMode="numeric"
        autoComplete="off"
      />
      <TextField
        id="studentName"
        label="Họ và tên"
        value={studentName}
        onChange={setNameDraft}
        error={errors.studentName}
        disabled={isPending}
        autoComplete="name"
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label>Điểm</Label>
          <span className="text-2xl font-bold tabular-nums">{score === null ? "—" : formatScore(score)}</span>
        </div>
        <ScoreGrid options={scoreOptions} value={score} onChange={setScore} disabled={isPending} describedBy={errors.score ? "score-error" : undefined} />
        <FieldError id="score-error" message={errors.score} />
      </div>
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={isPending}>
        {isPending ? "Đang gửi…" : submitted ? "Cập nhật điểm" : "Gửi điểm"}
      </Button>
    </form>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error: string | null | undefined;
  disabled: boolean;
  inputMode?: "numeric" | "text";
  autoComplete: string;
}

function TextField({ id, label, value, onChange, onBlur, error, disabled, inputMode, autoComplete }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="h-12 text-lg tabular-nums"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

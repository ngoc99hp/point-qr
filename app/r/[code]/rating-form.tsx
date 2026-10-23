"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { submitRating, type SubmitRatingResult } from "@/app/actions/ratings";
import { FieldError } from "@/components/field-error";
import { QueryProvider } from "@/components/query-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getOrCreateDeviceId,
  parseStudent,
  readStudentRaw,
  saveStudent,
} from "@/lib/student-storage";
import type { PublicCurrentResponse } from "@/lib/types/live";
import { ScoreGrid } from "./score-grid";
import { useStudentCodeCheck } from "./use-student-code-check";

const POLL_CURRENT_MS = 3_000;
const subscribeNoop = () => () => {};

interface RatingFormProps {
  eventCode: string;
  eventTitle: string;
  scoreOptions: number[];
  initialCurrent: PublicCurrentResponse;
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

type Submitted = { roundId: string; score: number; status: "created" | "updated" };
type FieldErrors = Partial<Record<"studentCode" | "studentName" | "score", string>>;

function RatingFormContent({ eventCode, eventTitle, scoreOptions, initialCurrent }: RatingFormProps) {
  const { data, refetch } = useQuery({
    queryKey: ["current", eventCode],
    queryFn: () => fetchCurrent(eventCode),
    initialData: initialCurrent,
    refetchInterval: POLL_CURRENT_MS,
    refetchIntervalInBackground: false,
    // initialData comes from the server render; don't refetch immediately on mount.
    staleTime: POLL_CURRENT_MS - 500,
  });
  const current = data.current;
  const roundId = current?.roundId ?? null;

  // Autofill from localStorage without an effect (server snapshot: nothing stored).
  const storedRaw = useSyncExternalStore(subscribeNoop, () => readStudentRaw(), () => null);
  const stored = useMemo(() => parseStudent(storedRaw), [storedRaw]);
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const studentCode = codeDraft ?? stored?.studentCode ?? "";
  const studentName = nameDraft ?? stored?.studentName ?? "";

  // Score and errors belong to one round: a newly opened group starts fresh.
  const [selection, setSelection] = useState<{ roundId: string; score: number } | null>(null);
  const [errorState, setErrorState] = useState<{ roundId: string | null; errors: FieldErrors }>({
    roundId: null,
    errors: {},
  });
  const score = selection && selection.roundId === roundId ? selection.score : null;
  const errors = errorState.roundId === roundId ? errorState.errors : {};
  const setErrors = (next: FieldErrors) => setErrorState({ roundId, errors: next });
  const setScore = (next: number) => roundId && setSelection({ roundId, score: next });

  const codeCheck = useStudentCodeCheck(eventCode, roundId, studentCode);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResult(result: SubmitRatingResult, submittedScore: number, forRound: string) {
    if (result.success) {
      // Remember only details the server accepted, for autofill on the next group.
      saveStudent({ studentCode, studentName });
      setSubmitted({ roundId: forRound, score: submittedScore, status: result.data.status });
      toast.success(result.data.status === "created" ? "Đã gửi điểm." : "Đã cập nhật điểm.");
      return;
    }
    const { code, message, field } = result.error;
    if (field === "studentCode" || field === "studentName" || field === "score") {
      setErrors({ [field]: message });
    } else {
      toast.error(message);
    }
    if (code === "ROUND_CLOSED" || code === "TICKET_INVALID") void refetch();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || isPending) return;
    if (score === null) {
      setErrors({ score: "Vui lòng chọn điểm." });
      return;
    }
    const forRound = current.roundId;
    const chosen = score;
    setErrors({});
    startTransition(async () => {
      try {
        const result = await submitRating({
          eventCode,
          roundId: forRound,
          studentCode,
          studentName,
          score: chosen,
          deviceId: getOrCreateDeviceId(),
        });
        handleResult(result, chosen, forRound);
      } catch {
        toast.error("Không gửi được. Kiểm tra kết nối mạng rồi thử lại.");
      }
    });
  }

  const alreadySent = submitted && submitted.roundId === roundId ? submitted : null;
  // D4: server-side submit errors win; otherwise show the live roster hint.
  const studentCodeError = errors.studentCode ?? codeCheck.hint;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{eventTitle}</p>
        <h1 className="text-3xl font-bold leading-tight" aria-live="polite">
          {current ? `Đang chấm: ${current.groupName}` : "Chưa có phiên chấm"}
        </h1>
      </header>

      {!current ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          Chưa có nhóm nào đang mở chấm. Trang sẽ tự cập nhật khi giảng viên mở phiên.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          {alreadySent ? (
            <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              Bạn đã {alreadySent.status === "created" ? "gửi" : "cập nhật"}{" "}
              <strong>{String(alreadySent.score).replace(".", ",")} điểm</strong> cho {current.groupName}.
              Gửi lại nếu muốn sửa điểm.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="studentCode">Mã sinh viên</Label>
            <Input
              id="studentCode"
              value={studentCode}
              onChange={(e) => setCodeDraft(e.target.value)}
              onBlur={codeCheck.checkNow}
              inputMode="numeric"
              autoComplete="off"
              className="h-12 text-lg tabular-nums"
              aria-invalid={Boolean(studentCodeError)}
              aria-describedby={studentCodeError ? "studentCode-error" : undefined}
              disabled={isPending}
            />
            <FieldError id="studentCode-error" message={studentCodeError} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="studentName">Họ và tên</Label>
            <Input
              id="studentName"
              value={studentName}
              onChange={(e) => setNameDraft(e.target.value)}
              autoComplete="name"
              className="h-12 text-lg"
              aria-invalid={Boolean(errors.studentName)}
              aria-describedby={errors.studentName ? "studentName-error" : undefined}
              disabled={isPending}
            />
            <FieldError id="studentName-error" message={errors.studentName} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Điểm</Label>
              <span className="text-2xl font-bold tabular-nums">
                {score === null ? "—" : String(score).replace(".", ",")}
              </span>
            </div>
            <ScoreGrid
              options={scoreOptions}
              value={score}
              onChange={setScore}
              disabled={isPending}
              describedBy={errors.score ? "score-error" : undefined}
            />
            <FieldError id="score-error" message={errors.score} />
          </div>
          <Button type="submit" size="lg" className="h-14 text-lg" disabled={isPending}>
            {isPending ? "Đang gửi…" : alreadySent ? "Cập nhật điểm" : "Gửi điểm"}
          </Button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { checkStudentCode, type StudentCodeStatus } from "@/app/actions/ratings";
import { getOrCreateDeviceId } from "@/lib/student-storage";

const DEBOUNCE_MS = 500;
const MIN_LENGTH_TO_CHECK = 3;
const ROSTER_ANSWER_STALE_MS = 60_000;

/** Roster answers are stable for a round; gate answers (rate limit, ticket) are not. */
const CACHEABLE: ReadonlySet<StudentCodeStatus> = new Set(["OK", "INVALID_FORMAT", "NOT_IN_ROSTER", "SELF_RATING"]);

const STATUS_MESSAGE: Partial<Record<StudentCodeStatus, string>> = {
  INVALID_FORMAT: "MSV không đúng định dạng.",
  NOT_IN_ROSTER: "MSV không có trong danh sách lớp. Kiểm tra lại hoặc báo giảng viên.",
  SELF_RATING: "Bạn không thể chấm nhóm của mình.",
};

/**
 * D4: checks the typed student code against the roster after the student pauses
 * typing (or leaves the field). Returns a Vietnamese hint, or null when fine.
 * Keyed by round (SELF_RATING depends on it) but not by ticket, so the static-QR
 * ticket refreshed by every poll does not re-trigger checks.
 */
export function useStudentCodeCheck(input: { eventCode: string; roundId: string; ticket: string; studentCode: string }) {
  const code = input.studentCode.trim();
  const [debounced, setDebounced] = useState(code);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(code), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code]);

  const { data } = useQuery({
    queryKey: ["student-code", input.eventCode, input.roundId, debounced],
    queryFn: () =>
      checkStudentCode({
        eventCode: input.eventCode,
        ticket: input.ticket,
        deviceId: getOrCreateDeviceId(),
        studentCode: debounced,
      }),
    enabled: debounced.length >= MIN_LENGTH_TO_CHECK,
    staleTime: (query) => {
      const result = query.state.data;
      return result?.success && CACHEABLE.has(result.data.status) ? ROSTER_ANSWER_STALE_MS : 0;
    },
    refetchOnWindowFocus: false,
  });

  const isCurrent = debounced === code;
  const hint = isCurrent && data?.success ? (STATUS_MESSAGE[data.data.status] ?? null) : null;
  return { hint, checkNow: () => setDebounced(code) };
}

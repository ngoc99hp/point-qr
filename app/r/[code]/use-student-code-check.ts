"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { checkStudentCode, type StudentCodeStatus } from "@/app/actions/ratings";

const DEBOUNCE_MS = 500;
const MIN_LENGTH_TO_CHECK = 3;

const STATUS_MESSAGE: Partial<Record<StudentCodeStatus, string>> = {
  INVALID_FORMAT: "MSV không đúng định dạng.",
  NOT_IN_ROSTER: "MSV không có trong danh sách lớp. Kiểm tra lại hoặc báo giảng viên.",
  SELF_RATING: "Bạn không thể chấm nhóm của mình.",
};

/**
 * D4: checks the typed student code against the roster after the student pauses
 * typing (or leaves the field). Returns a Vietnamese hint, or null when fine.
 */
export function useStudentCodeCheck(eventCode: string, roundId: string | null, studentCode: string) {
  const code = studentCode.trim();
  const [debounced, setDebounced] = useState(code);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(code), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code]);

  const { data } = useQuery({
    queryKey: ["student-code", eventCode, roundId, debounced],
    queryFn: () => checkStudentCode({ eventCode, roundId: roundId ?? "", studentCode: debounced }),
    enabled: Boolean(roundId) && debounced.length >= MIN_LENGTH_TO_CHECK,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const isCurrent = debounced === code;
  const hint = isCurrent && data?.success ? (STATUS_MESSAGE[data.data.status] ?? null) : null;
  return { hint, checkNow: () => setDebounced(code) };
}

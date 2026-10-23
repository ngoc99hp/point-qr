"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { checkStudentCode, type StudentCodeStatus } from "@/app/actions/ratings";
import { getOrCreateDeviceId } from "@/lib/student-storage";

const DEBOUNCE_MS = 500;
const MIN_LENGTH_TO_CHECK = 3;

const STATUS_MESSAGE: Partial<Record<StudentCodeStatus, string>> = {
  INVALID_FORMAT: "MSV không đúng định dạng.",
  NOT_IN_ROSTER: "MSV không có trong danh sách lớp. Kiểm tra lại hoặc báo giảng viên.",
  SELF_RATING: "Bạn không thể chấm nhóm của mình.",
  RATE_LIMITED: "Bạn kiểm tra quá nhanh. Vui lòng đợi một chút.",
};

/**
 * D4: checks the typed student code against the roster after the student pauses
 * typing (or leaves the field). Returns a Vietnamese hint, or null when fine.
 */
export function useStudentCodeCheck(eventCode: string, ticket: string, studentCode: string) {
  const code = studentCode.trim();
  const [debounced, setDebounced] = useState(code);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(code), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code]);

  const { data } = useQuery({
    // The ticket is not part of the key: a refreshed static-QR ticket for the same
    // round must not re-check codes that were already checked.
    queryKey: ["student-code", eventCode, debounced],
    queryFn: () =>
      checkStudentCode({ eventCode, ticket, deviceId: getOrCreateDeviceId(), studentCode: debounced }),
    enabled: debounced.length >= MIN_LENGTH_TO_CHECK,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const isCurrent = debounced === code;
  const hint = isCurrent && data?.success ? (STATUS_MESSAGE[data.data.status] ?? null) : null;
  return { hint, checkNow: () => setDebounced(code) };
}

"use client";

import { useState, useTransition } from "react";
import { submitRating, type SubmitRatingResult } from "@/app/actions/ratings";
import { getOrCreateDeviceId, saveStudent } from "@/lib/student-storage";
import type { Notice } from "./student-ui";

export type FieldErrors = Partial<Record<"studentCode" | "studentName" | "score", string>>;

export interface Submitted {
  score: number;
  status: "created" | "updated";
}

interface SubmissionInput {
  eventCode: string;
  ticket: string;
  studentCode: string;
  studentName: string;
  score: number | null;
}

/** Submit flow for one round's form: score check, server call, inline feedback. */
export function useRatingSubmission(onStale: () => void) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResult(result: SubmitRatingResult, input: SubmissionInput & { score: number }) {
    if (result.success) {
      // Remember only details the server accepted, for autofill on the next group.
      saveStudent({ studentCode: input.studentCode, studentName: input.studentName });
      setSubmitted({ score: input.score, status: result.data.status });
      setNotice({ kind: "success", text: result.data.status === "created" ? "Đã gửi điểm." : "Đã cập nhật điểm." });
      return;
    }
    const { code, message, field } = result.error;
    if (field === "studentCode" || field === "studentName" || field === "score") {
      setErrors({ [field]: message });
    } else {
      setNotice({ kind: "error", text: message });
    }
    if (code === "ROUND_CLOSED" || code === "TICKET_INVALID" || code === "TICKET_EXPIRED") onStale();
  }

  function submit(input: SubmissionInput) {
    if (isPending) return;
    const { score } = input;
    setNotice(null);
    if (score === null) {
      setErrors({ score: "Vui lòng chọn điểm." });
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await submitRating({
          eventCode: input.eventCode,
          ticket: input.ticket,
          studentCode: input.studentCode,
          studentName: input.studentName,
          score,
          deviceId: getOrCreateDeviceId(),
        });
        handleResult(result, { ...input, score });
      } catch {
        setNotice({ kind: "error", text: "Không gửi được. Kiểm tra kết nối mạng rồi thử lại." });
      }
    });
  }

  return { errors, submitted, notice, isPending, submit };
}

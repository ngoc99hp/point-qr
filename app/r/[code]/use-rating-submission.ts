"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitRating, type SubmitRatingResult } from "@/app/actions/ratings";
import { getOrCreateDeviceId, saveStudent } from "@/lib/student-storage";

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

/** Submit flow for one round's form: validation of the score, server call, feedback. */
export function useRatingSubmission(onStale: () => void) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResult(result: SubmitRatingResult, input: SubmissionInput & { score: number }) {
    if (result.success) {
      // Remember only details the server accepted, for autofill on the next group.
      saveStudent({ studentCode: input.studentCode, studentName: input.studentName });
      setSubmitted({ score: input.score, status: result.data.status });
      toast.success(result.data.status === "created" ? "Đã gửi điểm." : "Đã cập nhật điểm.");
      return;
    }
    const { code, message, field } = result.error;
    if (field === "studentCode" || field === "studentName" || field === "score") {
      setErrors({ [field]: message });
    } else {
      toast.error(message);
    }
    if (code === "ROUND_CLOSED" || code === "TICKET_INVALID" || code === "TICKET_EXPIRED") onStale();
  }

  function submit(input: SubmissionInput) {
    if (isPending) return;
    const { score } = input;
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
        toast.error("Không gửi được. Kiểm tra kết nối mạng rồi thử lại.");
      }
    });
  }

  return { errors, submitted, isPending, submit };
}

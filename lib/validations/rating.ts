import { z } from "zod";

export const STUDENT_NAME_MIN = 2;
export const STUDENT_NAME_MAX = 100;

/** P1 contract: `roundId` stands in for the HMAC ticket that arrives in P3 (SPEC §14 P1). */
export const submitRatingSchema = z.object({
  eventCode: z.string().trim().min(1).max(16),
  roundId: z.string().trim().min(1).max(64),
  studentCode: z.string().trim().min(1, "Vui lòng nhập MSV.").max(32, "MSV quá dài."),
  studentName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(STUDENT_NAME_MIN, `Họ tên tối thiểu ${STUDENT_NAME_MIN} ký tự.`)
        .max(STUDENT_NAME_MAX, `Họ tên tối đa ${STUDENT_NAME_MAX} ký tự.`),
    ),
  score: z.number({ error: "Vui lòng chọn điểm." }).finite("Vui lòng chọn điểm."),
  deviceId: z.uuid(),
});

export type SubmitRatingInput = z.input<typeof submitRatingSchema>;

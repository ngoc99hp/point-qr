import { z } from "zod";

export const STUDENT_NAME_MIN = 2;
export const STUDENT_NAME_MAX = 100;

const MAX_TICKET_LENGTH = 512;

export const ticketSchema = z.string().trim().min(1).max(MAX_TICKET_LENGTH);

/** SPEC §7 contract: the signed ticket (§9.2) identifies the round. */
export const submitRatingSchema = z.object({
  eventCode: z.string().trim().min(1).max(16),
  ticket: ticketSchema,
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

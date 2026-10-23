import { z } from "zod";
import { isSafeStudentCodePattern } from "@/lib/normalize";

export const EVENT_TITLE_MAX = 120;
export const STUDENT_CODE_PATTERN_MAX = 100;
export const SCORE_STEPS = [0.1, 0.5, 1] as const;
export const SCORE_LIMIT_MIN = 0;
export const SCORE_LIMIT_MAX = 10;
export const TRIM_RATIO_MAX = 0.4;

const id = z.string().min(1).max(64);

const title = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập tên buổi đánh giá.")
  .max(EVENT_TITLE_MAX, `Tên tối đa ${EVENT_TITLE_MAX} ký tự.`);

const scoreLimit = z.coerce
  .number({ error: "Vui lòng nhập số." })
  .min(SCORE_LIMIT_MIN, `Tối thiểu ${SCORE_LIMIT_MIN}.`)
  .max(SCORE_LIMIT_MAX, `Tối đa ${SCORE_LIMIT_MAX}.`)
  .refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9, {
    message: "Chỉ dùng tối đa 1 chữ số thập phân.",
  });

export const createEventSchema = z.object({ title });

export const eventSettingsSchema = z
  .object({
    eventId: id,
    title,
    minScore: scoreLimit,
    maxScore: scoreLimit,
    scoreStep: z.coerce
      .number()
      .refine((value) => SCORE_STEPS.some((step) => step === value), {
        message: "Bước điểm phải là 0,1 / 0,5 / 1.",
      }),
    studentCodePattern: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập định dạng MSV.")
      .max(STUDENT_CODE_PATTERN_MAX, `Tối đa ${STUDENT_CODE_PATTERN_MAX} ký tự.`)
      .refine(isSafeStudentCodePattern, {
        message: "Định dạng MSV không hợp lệ hoặc quá phức tạp (không dùng nhóm lặp lồng nhau, lookaround).",
      }),
    // P2: display-only settings, editable at any time (SPEC §6.4).
    rankingMetric: z.enum(["MEAN", "TRIMMED_MEAN", "MEDIAN"]),
    trimRatio: z.coerce
      .number({ error: "Vui lòng nhập số." })
      .min(0, "Tối thiểu 0.")
      .max(TRIM_RATIO_MAX, `Tối đa ${TRIM_RATIO_MAX}.`),
    strictRoster: z.boolean(),
  })
  .refine((value) => value.minScore < value.maxScore, {
    message: "Điểm tối đa phải lớn hơn điểm tối thiểu.",
    path: ["maxScore"],
  });

export type EventSettingsInput = z.infer<typeof eventSettingsSchema>;

export const eventIdSchema = z.object({ eventId: id });

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập tên nhóm.")
  .max(50, "Tên nhóm tối đa 50 ký tự.");

export const renameGroupSchema = z.object({ groupId: id, name: groupNameSchema });
export const groupIdSchema = z.object({ groupId: id });
export const moveGroupSchema = z.object({ groupId: id, direction: z.enum(["up", "down"]) });
export const roundIdSchema = z.object({ roundId: id });

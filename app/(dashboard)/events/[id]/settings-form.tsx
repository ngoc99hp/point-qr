"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateEventSettings } from "@/app/actions/events";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { EVENT_TITLE_MAX, SCORE_STEPS, STUDENT_CODE_PATTERN_MAX } from "@/lib/validations/event";

export interface EventSettingsValues {
  eventId: string;
  title: string;
  minScore: number;
  maxScore: number;
  scoreStep: number;
  studentCodePattern: string;
}

export function SettingsForm({ values, disabled }: { values: EventSettingsValues; disabled: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateEventSettings,
    null,
  );
  const fieldError = (field: string) =>
    state && !state.success && state.error.field === field ? state.error.message : null;
  const formError = state && !state.success && !state.error.field ? state.error.message : null;

  useEffect(() => {
    if (state?.success) toast.success("Đã lưu cấu hình.");
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="eventId" value={values.eventId} />
      <fieldset disabled={disabled || isPending} className="contents">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">Tên buổi đánh giá</Label>
          <Input id="title" name="title" defaultValue={values.title} maxLength={EVENT_TITLE_MAX} required />
          <FieldError id="title-error" message={fieldError("title")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="minScore">Điểm tối thiểu</Label>
          <Input id="minScore" name="minScore" type="number" inputMode="decimal" step="0.1" min={0} max={10} defaultValue={values.minScore} required />
          <FieldError id="minScore-error" message={fieldError("minScore")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxScore">Điểm tối đa</Label>
          <Input id="maxScore" name="maxScore" type="number" inputMode="decimal" step="0.1" min={0} max={10} defaultValue={values.maxScore} required />
          <FieldError id="maxScore-error" message={fieldError("maxScore")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scoreStep">Bước điểm</Label>
          <select
            id="scoreStep"
            name="scoreStep"
            defaultValue={String(values.scoreStep)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          >
            {SCORE_STEPS.map((step) => (
              <option key={step} value={String(step)}>
                {String(step).replace(".", ",")}
              </option>
            ))}
          </select>
          <FieldError id="scoreStep-error" message={fieldError("scoreStep")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="studentCodePattern">Định dạng MSV (regex)</Label>
          <Input
            id="studentCodePattern"
            name="studentCodePattern"
            defaultValue={values.studentCodePattern}
            maxLength={STUDENT_CODE_PATTERN_MAX}
            className="font-mono"
            required
          />
          <FieldError id="studentCodePattern-error" message={fieldError("studentCodePattern")} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit">{isPending ? "Đang lưu…" : "Lưu cấu hình"}</Button>
          {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
        </div>
      </fieldset>
    </form>
  );
}

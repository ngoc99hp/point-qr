"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/actions/events";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { EVENT_TITLE_MAX } from "@/lib/validations/event";

export function CreateEventForm() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createEvent,
    null,
  );
  const error = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="title">Tạo buổi đánh giá mới</Label>
        <Input
          id="title"
          name="title"
          placeholder="VD: Thuyết trình môn Kỹ năng mềm — Lớp K24A"
          maxLength={EVENT_TITLE_MAX}
          required
          disabled={isPending}
          aria-describedby={error ? "title-error" : undefined}
        />
        <FieldError id="title-error" message={error} />
      </div>
      <Button type="submit" disabled={isPending} className="sm:mb-0">
        {isPending ? "Đang tạo…" : "Tạo"}
      </Button>
    </form>
  );
}

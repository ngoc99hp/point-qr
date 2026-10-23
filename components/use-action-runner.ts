"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Runs a Server Action in a transition and reports failures as toasts.
 * Returns the result so callers can react to success.
 */
export function useActionRunner() {
  const [isPending, startTransition] = useTransition();

  function run<Data>(
    action: () => Promise<ActionResult<Data>>,
    onSuccess?: (data: Data) => void,
  ): void {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success) onSuccess?.(result.data);
        else toast.error(result.error.message);
      } catch {
        toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    });
  }

  return { isPending, run };
}

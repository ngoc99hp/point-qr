"use client";

import { toast } from "sonner";
import { setEventArchived } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";

export function ArchiveButton({ eventId, isArchived }: { eventId: string; isArchived: boolean }) {
  const { isPending, run } = useActionRunner();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        run(
          () => setEventArchived(eventId, !isArchived),
          () => toast.success(isArchived ? "Đã khôi phục buổi đánh giá." : "Đã lưu trữ buổi đánh giá."),
        )
      }
    >
      {isArchived ? "Khôi phục" : "Lưu trữ"}
    </Button>
  );
}

"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEvent } from "@/app/actions/events";
import { clearRoster } from "@/app/actions/roster";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";

interface ClearRosterButtonProps {
  eventId: string;
  studentCount: number;
  disabled: boolean;
}

export function ClearRosterButton({ eventId, studentCount, disabled }: ClearRosterButtonProps) {
  const { isPending, run } = useActionRunner();
  return (
    <ConfirmDialog
      title="Xóa toàn bộ danh sách lớp?"
      description={
        <>
          <span>{studentCount} sinh viên sẽ bị xóa khỏi buổi đánh giá này.</span>
          <span>Nhóm và các phiếu đã chấm vẫn được giữ lại. Nếu chỉ nhận MSV trong danh sách, sinh viên sẽ không gửi phiếu được cho đến khi nhập lại.</span>
        </>
      }
      confirmLabel="Xóa danh sách"
      onConfirm={() => run(() => clearRoster(eventId), ({ deleted }) => toast.success(`Đã xóa ${deleted} sinh viên.`))}
      trigger={
        <Button variant="outline" size="sm" disabled={disabled || isPending || studentCount === 0}>
          <Trash2 aria-hidden /> Xóa danh sách lớp
        </Button>
      }
    />
  );
}

interface DeleteEventButtonProps {
  eventId: string;
  eventCode: string;
  ratingCount: number;
}

export function DeleteEventButton({ eventId, eventCode, ratingCount }: DeleteEventButtonProps) {
  const { isPending, run } = useActionRunner();
  return (
    <ConfirmDialog
      title="Xóa vĩnh viễn buổi đánh giá?"
      description={
        <>
          <span className="font-medium text-destructive">
            Toàn bộ nhóm, danh sách lớp và {ratingCount} phiếu chấm sẽ bị xóa. Không thể khôi phục.
          </span>
          <span>Nên tải CSV ở trang Kết quả trước nếu cần lưu lại.</span>
        </>
      }
      confirmLabel="Xóa vĩnh viễn"
      requireText={eventCode}
      onConfirm={() => run(() => deleteEvent(eventId, eventCode))}
      trigger={
        <Button variant="destructive" disabled={isPending}>
          <Trash2 aria-hidden /> Xóa buổi đánh giá
        </Button>
      }
    />
  );
}

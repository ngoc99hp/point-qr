"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { addGroup, deleteGroup, moveGroup, renameGroup } from "@/app/actions/roster";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionRunner } from "@/components/use-action-runner";
import type { GroupRoundStatus } from "@/lib/types/live";

export interface ManagedGroup {
  id: string;
  name: string;
  roundStatus: GroupRoundStatus;
  ratingCount: number;
  studentCount: number;
}

const STATUS_TONE: Record<GroupRoundStatus, PillTone> = { NONE: "idle", OPEN: "live", CLOSED: "done" };

const STATUS_LABEL: Record<GroupRoundStatus, string> = {
  NONE: "Chưa chấm",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
};

interface GroupManagerProps {
  eventId: string;
  groups: ManagedGroup[];
  disabled: boolean;
}

export function GroupManager({ eventId, groups, disabled }: GroupManagerProps) {
  const { isPending, run } = useActionRunner();
  const isLocked = disabled || isPending;

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có nhóm nào. Thêm nhóm để bắt đầu.
        </p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {groups.map((group, index) => (
            <GroupRow
              key={group.id}
              group={group}
              isFirst={index === 0}
              isLast={index === groups.length - 1}
              isLocked={isLocked}
              onMove={(direction) => run(() => moveGroup(group.id, direction))}
              onDelete={() => run(() => deleteGroup(group.id, group.ratingCount > 0))}
              onRename={(name, done) => run(() => renameGroup(group.id, name), done)}
            />
          ))}
        </ol>
      )}
      <Button variant="outline" className="self-start" disabled={isLocked} onClick={() => run(() => addGroup(eventId))}>
        <Plus aria-hidden /> Thêm nhóm
      </Button>
    </div>
  );
}

interface GroupRowProps {
  group: ManagedGroup;
  isFirst: boolean;
  isLast: boolean;
  isLocked: boolean;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  onRename: (name: string, done: () => void) => void;
}

function GroupRow({ group, isFirst, isLast, isLocked, onMove, onDelete, onRename }: GroupRowProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      {draft === null ? (
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{group.name}</span>
          <span className="ml-2 text-sm text-muted-foreground">{group.studentCount} SV</span>
        </span>
      ) : (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(draft, () => setDraft(null));
          }}
        >
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={50} autoFocus aria-label="Tên nhóm" />
          <Button type="submit" size="icon" variant="ghost" disabled={isLocked} aria-label="Lưu tên">
            <Check aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setDraft(null)} aria-label="Hủy">
            <X aria-hidden />
          </Button>
        </form>
      )}
      <StatusPill tone={STATUS_TONE[group.roundStatus]}>
        {STATUS_LABEL[group.roundStatus]}
        {group.roundStatus !== "NONE" ? ` · ${group.ratingCount} phiếu` : ""}
      </StatusPill>
      <div className="flex items-center">
        <Button size="icon" variant="ghost" disabled={isLocked || draft !== null} onClick={() => setDraft(group.name)} aria-label={`Đổi tên ${group.name}`}>
          <Pencil aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" disabled={isLocked || isFirst} onClick={() => onMove("up")} aria-label={`Đưa ${group.name} lên`}>
          <ArrowUp aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" disabled={isLocked || isLast} onClick={() => onMove("down")} aria-label={`Đưa ${group.name} xuống`}>
          <ArrowDown aria-hidden />
        </Button>
        <ConfirmDialog
          title={`Xóa ${group.name}?`}
          description={
            <>
              {group.ratingCount > 0 ? (
                <span className="font-medium text-destructive">
                  {group.ratingCount} phiếu chấm của nhóm này sẽ bị xóa vĩnh viễn.
                </span>
              ) : null}
              <span>Sinh viên của nhóm vẫn còn trong danh sách lớp nhưng không thuộc nhóm nào.</span>
            </>
          }
          confirmLabel="Xóa nhóm"
          onConfirm={onDelete}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              disabled={isLocked || group.roundStatus === "OPEN"}
              aria-label={`Xóa ${group.name}`}
              title={group.roundStatus === "OPEN" ? "Đóng phiên chấm trước khi xóa" : undefined}
            >
              <Trash2 aria-hidden />
            </Button>
          }
        />
      </div>
    </li>
  );
}

"use client";

import { ArrowDown, ArrowUp, Check, ChevronDown, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { addGroup, deleteGroup, moveGroup, renameGroup } from "@/app/actions/roster";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionRunner } from "@/components/use-action-runner";
import type { GroupRoundStatus } from "@/lib/types/live";
import { cn } from "@/lib/utils";

export interface GroupStudent {
  code: string;
  fullName: string;
}

export interface ManagedGroup {
  id: string;
  name: string;
  roundStatus: GroupRoundStatus;
  ratingCount: number;
  students: GroupStudent[];
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
  /** Roster students without a group (e.g. after their group was deleted). */
  ungroupedStudents: GroupStudent[];
  disabled: boolean;
}

export function GroupManager({ eventId, groups, ungroupedStudents, disabled }: GroupManagerProps) {
  const { isPending, run } = useActionRunner();
  const isLocked = disabled || isPending;

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có nhóm nào. Thêm nhóm hoặc nhập danh sách lớp để bắt đầu.
        </p>
      ) : (
        <ol className="divide-y overflow-hidden rounded-2xl border">
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
      {ungroupedStudents.length > 0 ? (
        <details className="rounded-2xl border border-sun/50 bg-sun/10 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            {ungroupedStudents.length} sinh viên chưa có nhóm
          </summary>
          <StudentList students={ungroupedStudents} className="mt-2" />
        </details>
      ) : null}
      <Button variant="outline" className="self-start" disabled={isLocked} onClick={() => run(() => addGroup(eventId))}>
        <Plus aria-hidden /> Thêm nhóm
      </Button>
    </div>
  );
}

/** Numbered list of a group's students (MSV + full name). */
function StudentList({ students, className }: { students: GroupStudent[]; className?: string }) {
  if (students.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Nhóm chưa có sinh viên nào.</p>;
  }
  return (
    <ol className={cn("flex flex-col gap-1", className)}>
      {students.map((student, index) => (
        <li key={student.code} className="flex items-baseline gap-3 rounded-lg bg-card px-3 py-1.5 text-sm">
          <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{index + 1}</span>
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{student.code}</span>
          <span className="min-w-0 font-medium">{student.fullName}</span>
        </li>
      ))}
    </ol>
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
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `group-students-${group.id}`;

  return (
    <li className={cn("px-3 py-2", isOpen && "bg-muted/40")}>
      <div className="flex flex-wrap items-center gap-2">
        {draft === null ? (
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
            <span className="truncate font-semibold">{group.name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              <Users aria-hidden className="size-3" /> {group.students.length} SV
            </span>
          </button>
        ) : (
          <RenameForm draft={draft} setDraft={setDraft} isLocked={isLocked} onSubmit={() => onRename(draft, () => setDraft(null))} />
        )}
        <StatusPill tone={STATUS_TONE[group.roundStatus]}>
          {STATUS_LABEL[group.roundStatus]}
          {group.roundStatus !== "NONE" ? ` · ${group.ratingCount} phiếu` : ""}
        </StatusPill>
        <GroupActions
          group={group}
          isFirst={isFirst}
          isLast={isLast}
          isLocked={isLocked}
          isRenaming={draft !== null}
          onStartRename={() => setDraft(group.name)}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
      {isOpen ? (
        <div id={panelId} className="pt-2 pb-1 pl-6">
          <StudentList students={group.students} />
        </div>
      ) : null}
    </li>
  );
}

interface RenameFormProps {
  draft: string;
  setDraft: (value: string | null) => void;
  isLocked: boolean;
  onSubmit: () => void;
}

function RenameForm({ draft, setDraft, isLocked, onSubmit }: RenameFormProps) {
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
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
  );
}

interface GroupActionsProps {
  group: ManagedGroup;
  isFirst: boolean;
  isLast: boolean;
  isLocked: boolean;
  isRenaming: boolean;
  onStartRename: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}

function GroupActions({ group, isFirst, isLast, isLocked, isRenaming, onStartRename, onMove, onDelete }: GroupActionsProps) {
  return (
    <div className="flex items-center">
      <Button size="icon" variant="ghost" disabled={isLocked || isRenaming} onClick={onStartRename} aria-label={`Đổi tên ${group.name}`}>
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
              <span className="font-medium text-destructive">{group.ratingCount} phiếu chấm của nhóm này sẽ bị xóa vĩnh viễn.</span>
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
  );
}

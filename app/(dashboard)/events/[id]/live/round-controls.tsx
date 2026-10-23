"use client";

import { useState } from "react";
import { closeRound, openRound } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/components/use-action-runner";
import { cn } from "@/lib/utils";
import type { LiveGroup, LiveResponse } from "@/lib/types/live";

interface RoundControlsProps {
  snapshot: LiveResponse;
  onChanged: () => void;
}

/** The group after the open one; with nothing open, the first group not yet rated. */
function nextGroup(groups: readonly LiveGroup[], currentGroupId: string | undefined) {
  if (currentGroupId) {
    const index = groups.findIndex((group) => group.id === currentGroupId);
    return groups[index + 1] ?? null;
  }
  return groups.find((group) => group.roundStatus === "NONE") ?? null;
}

export function RoundControls({ snapshot, onChanged }: RoundControlsProps) {
  const { isPending, run } = useActionRunner();
  const current = snapshot.current;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    snapshot.groups.find((group) => group.id === (selectedId ?? current?.groupId)) ??
    nextGroup(snapshot.groups, undefined) ??
    snapshot.groups[0] ??
    null;
  const next = nextGroup(snapshot.groups, current?.groupId);
  const isDisabled = isPending || snapshot.event.isArchived;

  const open = (groupId: string) =>
    run(() => openRound(groupId), () => {
      setSelectedId(groupId);
      onChanged();
    });

  if (snapshot.groups.length === 0) {
    return <p className="text-muted-foreground">Chưa có nhóm. Thêm nhóm ở trang thiết lập.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn nhóm">
        {snapshot.groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedId(group.id)}
            aria-pressed={selected?.id === group.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              group.roundStatus === "OPEN" && "border-primary bg-primary text-primary-foreground",
              group.roundStatus === "CLOSED" && "bg-muted text-muted-foreground",
              selected?.id === group.id && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
          >
            <span className="font-medium">{group.name}</span>
            {group.roundStatus !== "NONE" ? (
              <span className="ml-2 tabular-nums opacity-80">{group.validCount}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={isDisabled || !selected || selected.roundStatus === "OPEN"}
          onClick={() => selected && open(selected.id)}
        >
          {selected ? `Mở chấm ${selected.name}` : "Mở chấm"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={isDisabled || !current}
          onClick={() => current && run(() => closeRound(current.roundId), onChanged)}
        >
          Đóng
        </Button>
        <Button size="lg" variant="secondary" disabled={isDisabled || !next} onClick={() => next && open(next.id)}>
          {next ? `${next.name} →` : "Nhóm tiếp →"}
        </Button>
      </div>
    </div>
  );
}

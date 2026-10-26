"use client";

import { Check, Play, Square } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn nhóm">
        {snapshot.groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedId(group.id)}
            aria-pressed={selected?.id === group.id}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-2xl border bg-card px-4 text-sm font-semibold shadow-sm transition-all",
              "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              group.roundStatus === "OPEN" && "border-coral bg-coral text-white shadow-coral/30",
              group.roundStatus === "CLOSED" && "border-mint/40 bg-mint/10 text-score-high-ink",
              selected?.id === group.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            {group.roundStatus === "OPEN" ? <span aria-hidden className="size-2 animate-pulse rounded-full bg-white" /> : null}
            {group.roundStatus === "CLOSED" ? <Check aria-hidden className="size-4" /> : null}
            <span>{group.name}</span>
            {group.roundStatus !== "NONE" ? (
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums dark:bg-white/15">{group.validCount}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="h-12 rounded-2xl bg-brand-gradient px-6 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95"
          disabled={isDisabled || !selected || selected.roundStatus === "OPEN"}
          onClick={() => selected && open(selected.id)}
        >
          <Play aria-hidden /> {selected ? `Mở chấm ${selected.name}` : "Mở chấm"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 rounded-2xl px-6 text-base font-semibold"
          disabled={isDisabled || !current}
          onClick={() => current && run(() => closeRound(current.roundId), onChanged)}
        >
          <Square aria-hidden /> Đóng
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-12 rounded-2xl px-6 text-base font-semibold"
          disabled={isDisabled || !next}
          onClick={() => next && open(next.id)}
        >
          {next ? `${next.name} →` : "Nhóm tiếp →"}
        </Button>
      </div>
    </div>
  );
}

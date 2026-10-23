import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/mappers";
import { ArchiveButton } from "./archive-button";
import { GroupManager } from "./group-manager";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Thiết lập buổi đánh giá · PeerScore" };

export default function EventSetupPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-xl bg-muted" />}>
      <EventSetup params={params} />
    </Suspense>
  );
}

async function loadEvent(lecturerId: string, eventId: string) {
  return db.event.findFirst({
    where: { id: eventId, ownerId: lecturerId },
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      minScore: true,
      maxScore: true,
      scoreStep: true,
      studentCodePattern: true,
      groups: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          round: { select: { status: true, _count: { select: { ratings: true } } } },
        },
      },
    },
  });
}

async function EventSetup({ params }: { params: Promise<{ id: string }> }) {
  const [{ lecturerId }, { id }] = await Promise.all([requireLecturer(), params]);
  const event = await loadEvent(lecturerId, id);
  if (!event) notFound();

  const isArchived = event.status === "ARCHIVED";
  const groups = event.groups.map((group) => ({
    id: group.id,
    name: group.name,
    roundStatus: group.round?.status ?? ("NONE" as const),
    ratingCount: group.round?._count.ratings ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
            ← Tất cả buổi đánh giá
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Mã <span className="font-mono text-base font-semibold text-foreground">{event.code}</span>
            </span>
            {isArchived ? <Badge variant="secondary">Đã lưu trữ</Badge> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <ArchiveButton eventId={event.id} isArchived={isArchived} />
          {!isArchived ? (
            <Link href={`/events/${event.id}/live`} className={buttonVariants({ size: "default" })}>
              Mở màn chiếu
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nhóm thuyết trình</CardTitle>
            <CardDescription>Thứ tự ở đây là thứ tự bấm &quot;Nhóm tiếp&quot; trên màn chiếu.</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupManager eventId={event.id} groups={groups} disabled={isArchived} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cấu hình chấm điểm</CardTitle>
            <CardDescription>MSV được chuyển thành chữ in hoa trước khi kiểm tra định dạng.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              disabled={isArchived}
              values={{
                eventId: event.id,
                title: event.title,
                minScore: decimalToNumber(event.minScore),
                maxScore: decimalToNumber(event.maxScore),
                scoreStep: decimalToNumber(event.scoreStep),
                studentCodePattern: event.studentCodePattern,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

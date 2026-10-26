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
import { cn } from "@/lib/utils";
import { ArchiveButton } from "./archive-button";
import { ClearRosterButton, DeleteEventButton } from "./danger-actions";
import { GroupManager } from "./group-manager";
import { RosterImport } from "./roster-import";
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
      rankingMetric: true,
      trimRatio: true,
      strictRoster: true,
      rotatingQr: true,
      students: { orderBy: { code: "asc" }, select: { code: true, fullName: true, groupId: true } },
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

type LoadedEvent = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;

function settingsValues(event: LoadedEvent) {
  return {
    eventId: event.id,
    title: event.title,
    minScore: decimalToNumber(event.minScore),
    maxScore: decimalToNumber(event.maxScore),
    scoreStep: decimalToNumber(event.scoreStep),
    studentCodePattern: event.studentCodePattern,
    rankingMetric: event.rankingMetric,
    trimRatio: decimalToNumber(event.trimRatio),
    strictRoster: event.strictRoster,
    rotatingQr: event.rotatingQr,
  };
}

async function EventSetup({ params }: { params: Promise<{ id: string }> }) {
  const [{ lecturerId }, { id }] = await Promise.all([requireLecturer(), params]);
  const event = await loadEvent(lecturerId, id);
  if (!event) notFound();

  const isArchived = event.status === "ARCHIVED";
  const toStudent = ({ code, fullName }: { code: string; fullName: string }) => ({ code, fullName });
  const groups = event.groups.map((group) => ({
    id: group.id,
    name: group.name,
    roundStatus: group.round?.status ?? ("NONE" as const),
    ratingCount: group.round?._count.ratings ?? 0,
    students: event.students.filter((student) => student.groupId === group.id).map(toStudent),
  }));
  const ungroupedStudents = event.students.filter((student) => student.groupId === null).map(toStudent);
  const hasRatings = groups.some((group) => group.ratingCount > 0);
  const hasOpenRound = groups.some((group) => group.roundStatus === "OPEN");
  const isMissingRoster = event.students.length === 0 && event.strictRoster;

  return (
    <div className="flex flex-col gap-6">
      <EventHeader event={event} isArchived={isArchived} />

      {isMissingRoster ? (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Chưa có danh sách lớp — sinh viên sẽ không gửi được phiếu. Hãy nhập danh sách ở bên dưới.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nhóm thuyết trình</CardTitle>
            <CardDescription>
              {event.students.length} sinh viên. Bấm tên nhóm để xem danh sách sinh viên. Thứ tự ở đây là thứ tự bấm
              &quot;Nhóm tiếp&quot; trên màn chiếu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GroupManager eventId={event.id} groups={groups} ungroupedStudents={ungroupedStudents} disabled={isArchived} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Danh sách lớp</CardTitle>
                <CardDescription>Nhóm chưa có sẽ được tạo tự động theo cột &quot;Nhóm&quot;.</CardDescription>
              </div>
              <ClearRosterButton eventId={event.id} studentCount={event.students.length} disabled={isArchived || hasOpenRound} />
            </div>
          </CardHeader>
          <CardContent>
            <RosterImport
              eventId={event.id}
              studentCodePattern={event.studentCodePattern}
              existingCodes={event.students.map((student) => student.code)}
              canReplace={!hasRatings && !hasOpenRound}
              disabled={isArchived}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình chấm điểm</CardTitle>
          <CardDescription>
            Thang điểm và định dạng MSV bị khóa khi đã có phiếu chấm. Xếp hạng và tỷ lệ cắt đổi được bất cứ lúc nào.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm disabled={isArchived} values={settingsValues(event)} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Xóa buổi đánh giá</CardTitle>
          <CardDescription>
            Xóa vĩnh viễn buổi đánh giá cùng toàn bộ nhóm, danh sách lớp và phiếu chấm. Đóng phiên chấm đang mở trước khi xóa. Nếu chỉ muốn ẩn đi, dùng &quot;Lưu trữ&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteEventButton
            eventId={event.id}
            eventCode={event.code}
            ratingCount={groups.reduce((sum, group) => sum + group.ratingCount, 0)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EventHeader({ event, isArchived }: { event: LoadedEvent; isArchived: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
          ← Tất cả buổi đánh giá
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Mã{" "}
            <span data-testid="event-code" className="rounded-lg bg-secondary px-2 py-0.5 font-mono text-base font-bold tracking-wider text-secondary-foreground">
              {event.code}
            </span>
          </span>
          {isArchived ? <Badge variant="secondary">Đã lưu trữ</Badge> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ArchiveButton eventId={event.id} isArchived={isArchived} />
        <Link href={`/events/${event.id}/results`} className={buttonVariants({ variant: "outline" })}>
          Kết quả
        </Link>
        {!isArchived ? (
          <Link
            href={`/events/${event.id}/live`}
            className={cn(buttonVariants(), "bg-brand-gradient px-4 font-semibold text-white shadow-md shadow-primary/25 hover:opacity-95")}
          >
            Mở màn chiếu
          </Link>
        ) : null}
      </div>
    </div>
  );
}
